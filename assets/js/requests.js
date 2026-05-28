var Requests = {
    async create(data) {
        var user = await Auth.getUser();
        if (!user) throw new Error('로그인이 필요합니다.');
        var res = await window.supabaseClient
            .from('requests')
            .insert([Object.assign({}, data, { user_id: user.id })])
            .select()
            .single();
        if (res.error) throw res.error;
        return res.data;
    },

    async getMyRequests() {
        var user = await Auth.getUser();
        if (!user) return [];
        var res = await window.supabaseClient
            .from('requests')
            .select('*, bids(*, manufacturer:profiles!manufacturer_id(avg_rating, total_reviews, completed_count, nickname, specialty))')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        if (res.error) { console.error(res.error); return []; }
        return res.data || [];
    },

    async getById(id) {
        var res = await window.supabaseClient
            .from('requests')
            .select('*, bids(*, manufacturer:profiles!manufacturer_id(avg_rating, total_reviews, completed_count, nickname, specialty)), request_files(*)')
            .eq('id', id)
            .single();
        if (res.error) { console.error(res.error); return null; }
        return res.data;
    },

    async update(id, data) {
        var res = await window.supabaseClient
            .from('requests')
            .update(Object.assign({}, data, { updated_at: new Date().toISOString() }))
            .eq('id', id)
            .select()
            .single();
        if (res.error) throw res.error;
        return res.data;
    },

    async cancel(id) {
        return this.update(id, { status: 'cancelled' });
    },

    // ── 매칭 확정 + 가상 에스크로 결제 (Phase 4) ───────
    async confirmMatch(requestId, bidId, manufacturerName, unitPrice, paymentMethod) {
        var user = await Auth.getUser();
        if (!user) throw new Error('로그인이 필요합니다.');

        // 권한: 의뢰자 본인만
        var owner = await window.supabaseClient
            .from('requests').select('user_id, quantity, status')
            .eq('id', requestId).single();
        if (owner.error) throw owner.error;
        if (owner.data.user_id !== user.id) throw new Error('의뢰자 본인만 매칭할 수 있습니다.');
        if (owner.data.status !== 'bidding') throw new Error('이미 처리된 의뢰입니다.');

        var quantity     = owner.data.quantity || 0;
        var totalAmount  = unitPrice * quantity;
        var nowIso       = new Date().toISOString();

        var r1 = await window.supabaseClient
            .from('bids').update({ status: 'selected' }).eq('id', bidId);
        if (r1.error) throw r1.error;

        await window.supabaseClient
            .from('bids').update({ status: 'rejected' })
            .eq('request_id', requestId).neq('id', bidId);

        var req = await this.update(requestId, {
            status:          'matched',
            matched_bid_id:  bidId,
            payment_status:  'paid',
            payment_amount:  totalAmount,
            payment_method:  paymentMethod || '신용카드',
            paid_at:         nowIso
        });

        await window.supabaseClient.from('match_history').insert([{
            request_id:    requestId,
            bid_id:        bidId,
            category:      req.category,
            title:         req.title,
            quantity:      req.quantity,
            target_price:  req.target_price,
            matched_price: unitPrice,
            request_type:  req.request_type
        }]);
        return req;
    },

    // 기존 selectBid 호환 wrapper (paymentMethod 없는 호출 대응)
    async selectBid(requestId, bidId, manufacturerName, unitPrice) {
        return this.confirmMatch(requestId, bidId, manufacturerName, unitPrice, '신용카드');
    },

    // ── 제작 시작 (생산자) ────────────────────────────
    async startProduction(requestId) {
        var user = await Auth.getUser();
        if (!user) throw new Error('로그인이 필요합니다.');

        var req = await this.getById(requestId);
        if (!req) throw new Error('의뢰를 찾을 수 없습니다.');
        if (req.status !== 'matched') throw new Error('매칭된 상태에서만 제작을 시작할 수 있습니다.');

        // 권한: matched_bid_id의 manufacturer_id === user.id
        var bid = (req.bids || []).find(function(b){ return b.id === req.matched_bid_id; });
        if (!bid) throw new Error('매칭된 입찰을 찾을 수 없습니다.');
        if (bid.manufacturer_id !== user.id) throw new Error('매칭된 생산자만 제작을 시작할 수 있습니다.');

        return this.update(requestId, { status: 'producing' });
    },

    // ── 배송 시작 (생산자, 송장번호 입력) ──────────────
    async markShipped(requestId, trackingNumber) {
        var user = await Auth.getUser();
        if (!user) throw new Error('로그인이 필요합니다.');
        if (!trackingNumber || !String(trackingNumber).trim()) throw new Error('송장번호를 입력해주세요.');

        var req = await this.getById(requestId);
        if (!req) throw new Error('의뢰를 찾을 수 없습니다.');
        if (req.status !== 'producing') throw new Error('제작 중 상태에서만 배송을 시작할 수 있습니다.');

        var bid = (req.bids || []).find(function(b){ return b.id === req.matched_bid_id; });
        if (!bid || bid.manufacturer_id !== user.id) throw new Error('매칭된 생산자만 배송을 시작할 수 있습니다.');

        return this.update(requestId, {
            status:          'shipping',
            tracking_number: String(trackingNumber).trim(),
            shipped_at:      new Date().toISOString()
        });
    },

    // ── 수령 확인 (의뢰자) → 정산 완료 ────────────────
    async confirmDelivery(requestId) {
        var user = await Auth.getUser();
        if (!user) throw new Error('로그인이 필요합니다.');

        var req = await this.getById(requestId);
        if (!req) throw new Error('의뢰를 찾을 수 없습니다.');
        if (req.user_id !== user.id) throw new Error('의뢰자 본인만 수령 확인할 수 있습니다.');
        if (req.status !== 'shipping') throw new Error('배송 중 상태에서만 수령 확인할 수 있습니다.');

        var nowIso = new Date().toISOString();
        return this.update(requestId, {
            status:         'completed',
            completed_at:   nowIso,
            payment_status: 'released'
        });
    },

    // ── 7일 경과 자동 완료 처리 (앱 init 시 호출) ──────
    async autoCompleteOverdueShipping() {
        var sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        var overdue = await window.supabaseClient
            .from('requests')
            .select('id, user_id, matched_bid_id, title, bids(manufacturer_id)')
            .eq('status', 'shipping')
            .lt('shipped_at', sevenDaysAgo);
        if (overdue.error) { console.warn('자동 완료 조회 실패:', overdue.error.message); return []; }
        var rows = overdue.data || [];
        var nowIso = new Date().toISOString();
        var done = [];
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var upd = await window.supabaseClient
                .from('requests')
                .update({ status: 'completed', completed_at: nowIso, payment_status: 'released' })
                .eq('id', row.id)
                .eq('status', 'shipping'); // race-safe
            if (!upd.error) done.push(row);
        }
        return done;
    },

    // ── 결제·정산 내역 (역할별) ──────────────────────
    // role: 'client' (의뢰자) | 'manufacturer' (생산자)
    async getPaymentHistory(role) {
        var user = await Auth.getUser();
        if (!user) return [];

        if (role === 'manufacturer') {
            // 생산자: 본인이 selected된 입찰의 의뢰들
            var res = await window.supabaseClient
                .from('bids')
                .select('id, unit_price, requests(id, title, payment_status, payment_amount, payment_method, paid_at, completed_at, status, request_type)')
                .eq('manufacturer_id', user.id)
                .eq('status', 'selected')
                .order('created_at', { ascending: false });
            if (res.error) { console.error(res.error); return []; }
            return (res.data || []).filter(function(b){ return b.requests; }).map(function(b){
                return Object.assign({}, b.requests, { _bid_unit_price: b.unit_price });
            });
        }

        // 의뢰자: 본인의 결제 내역
        var res2 = await window.supabaseClient
            .from('requests')
            .select('id, title, payment_status, payment_amount, payment_method, paid_at, completed_at, status, request_type')
            .eq('user_id', user.id)
            .neq('payment_status', 'unpaid')
            .order('paid_at', { ascending: false });
        if (res2.error) { console.error(res2.error); return []; }
        return res2.data || [];
    },

    async getMatchHistory(type, limit) {
        var q = window.supabaseClient
            .from('match_history').select('*')
            .order('matched_at', { ascending: false })
            .limit(limit || 20);
        if (type) q = q.eq('request_type', type);
        var res = await q;
        if (res.error) { console.error(res.error); return []; }
        return res.data || [];
    },

    async getMyBids() {
        var user = await Auth.getUser();
        if (!user) return [];
        var res = await window.supabaseClient
            .from('bids')
            .select('*, requests(*), manufacturer:profiles!manufacturer_id(avg_rating, total_reviews, completed_count, nickname, specialty)')
            .eq('manufacturer_id', user.id)
            .order('created_at', { ascending: false });
        if (res.error) { console.error(res.error); return []; }
        return res.data || [];
    }
};

window.Requests = Requests;
console.log('✅ Requests 로드 완료');
