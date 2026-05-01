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
            .select('*, bids(*)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        if (res.error) { console.error(res.error); return []; }
        return res.data || [];
    },

    async getById(id) {
        var res = await window.supabaseClient
            .from('requests')
            .select('*, bids(*), request_files(*)')
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

    async selectBid(requestId, bidId, manufacturerName, unitPrice) {
        var r1 = await window.supabaseClient
            .from('bids').update({ status: 'selected' }).eq('id', bidId);
        if (r1.error) throw r1.error;

        await window.supabaseClient
            .from('bids').update({ status: 'rejected' })
            .eq('request_id', requestId).neq('id', bidId);

        var req = await this.update(requestId, { status: 'matched' });

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

    async getMatchHistory(type, limit) {
        var q = window.supabaseClient
            .from('match_history').select('*')
            .order('matched_at', { ascending: false })
            .limit(limit || 20);
        if (type) q = q.eq('request_type', type);
        var res = await q;
        if (res.error) { console.error(res.error); return []; }
        return res.data || [];
    }
};

window.Requests = Requests;
console.log('✅ Requests 로드 완료');
