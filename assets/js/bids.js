// =====================================================
// 실제 입찰 관리 모듈 (Phase 1)
// =====================================================

var Bids = {

    // ── 입찰 제출 ──────────────────────────────────────
    async submit(data) {
        var user = await Auth.getUser();
        if (!user) throw new Error('로그인이 필요합니다.');

        // 중복 입찰 확인
        var dup = await window.supabaseClient
            .from('bids').select('id')
            .eq('request_id', data.requestId)
            .eq('manufacturer_id', user.id);
        if (!dup.error && dup.data && dup.data.length > 0) {
            throw new Error('이미 이 의뢰에 입찰하셨습니다.');
        }

        // 수량 조회
        var reqRes = await window.supabaseClient
            .from('requests').select('quantity')
            .eq('id', data.requestId).single();
        var quantity = reqRes.data ? reqRes.data.quantity : 0;

        // 프로필에서 닉네임·전문분야 가져오기
        var profile = await Auth.getProfile();

        var res = await window.supabaseClient.from('bids').insert([{
            request_id:             data.requestId,
            manufacturer_id:        user.id,
            manufacturer_name:      profile ? (profile.nickname || '생산자') : '생산자',
            manufacturer_specialty: profile ? (profile.specialty || '') : '',
            manufacturer_rating:    5.0,
            manufacturer_completed: 0,
            unit_price:             data.unitPrice,
            total_price:            data.unitPrice * quantity,
            delivery_days:          data.deliveryDays,
            note:                   data.note || '',
            status:                 'pending'
        }]).select().single();

        if (res.error) throw res.error;
        return res.data;
    },

    // ── 견적서 파일 업로드 (Supabase Storage) ──────────
    async uploadQuoteFile(bidId, file) {
        var safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        var path = bidId + '/' + Date.now() + '_' + safeName;

        var uploadRes = await window.supabaseClient.storage
            .from('bid-files')
            .upload(path, file, { upsert: false });
        if (uploadRes.error) throw uploadRes.error;

        var urlData = window.supabaseClient.storage
            .from('bid-files')
            .getPublicUrl(uploadRes.data.path);
        var fileUrl = urlData.data.publicUrl;

        // 파일 메타 저장 (bid_files 테이블)
        var metaRes = await window.supabaseClient.from('bid_files').insert([{
            bid_id:    bidId,
            file_name: file.name,
            file_url:  fileUrl,
            file_size: file.size
        }]);
        if (metaRes.error) console.warn('파일 메타 저장 실패 (입찰은 등록됨):', metaRes.error.message);
        return fileUrl;
    },

    // ── 중복 입찰 여부 확인 ────────────────────────────
    async hasAlreadyBid(requestId) {
        var user = await Auth.getUser();
        if (!user) return false;
        var res = await window.supabaseClient
            .from('bids').select('id')
            .eq('request_id', requestId)
            .eq('manufacturer_id', user.id);
        return !res.error && res.data && res.data.length > 0;
    },

    // ── 의뢰 상태 업데이트 (생산자가 진행상황 변경) ───
    async updateRequestStatus(requestId, newStatus) {
        var res = await window.supabaseClient
            .from('requests')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', requestId)
            .select().single();
        if (res.error) throw res.error;
        return res.data;
    },

    // ── 생산자 프로필 저장 ─────────────────────────────
    async saveProfile(profileData) {
        var user = await Auth.getUser();
        if (!user) throw new Error('로그인이 필요합니다.');
        var res = await window.supabaseClient
            .from('profiles')
            .update({
                nickname:          profileData.nickname,
                specialty:         profileData.specialty,
                max_quantity:      profileData.maxQuantity || null,
                min_quantity:      profileData.minQuantity || null,
                manufacturer_intro: profileData.intro || ''
            })
            .eq('id', user.id);
        if (res.error) throw res.error;
    }
};

window.Bids = Bids;
console.log('✅ Bids 모듈 로드 완료');
