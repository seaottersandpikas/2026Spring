// =====================================================
// 거래 후기·평점 모듈 (Phase 7)
// =====================================================
// posts 테이블에 거래 컨텍스트(request_id/manufacturer_id/bid_id)를 함께 저장.
// 자유 게시물은 기존 submitPost()가 담당, 거래 후기는 이 모듈이 담당.

var Reviews = {

    // ── 거래 후기 등록 ────────────────────────────────
    async submit(data) {
        var user = await Auth.getUser();
        if (!user) throw new Error('로그인이 필요합니다.');

        var rating = parseInt(data.rating, 10);
        if (!(rating >= 1 && rating <= 5)) throw new Error('별점은 1~5 사이여야 합니다.');
        if (!data.requestId)      throw new Error('의뢰 정보가 없습니다.');
        if (!data.manufacturerId) throw new Error('생산자 정보가 없습니다.');
        var title   = String(data.title   || '').trim();
        var content = String(data.content || '').trim();
        if (!title || !content) throw new Error('제목과 내용을 입력해주세요.');

        // 권한·상태 검증
        var reqRes = await window.supabaseClient
            .from('requests')
            .select('user_id, status, title')
            .eq('id', data.requestId)
            .single();
        if (reqRes.error) throw reqRes.error;
        if (reqRes.data.user_id !== user.id) throw new Error('의뢰자 본인만 후기를 작성할 수 있습니다.');
        if (reqRes.data.status !== 'completed') throw new Error('거래가 완료된 의뢰만 후기를 작성할 수 있습니다.');

        // 중복 검사 (DB unique index가 최후 방어)
        if (await this.hasReviewed(data.requestId)) {
            throw new Error('이미 후기를 작성하셨습니다.');
        }

        var profile = await Auth.getProfile();
        var insertRes = await window.supabaseClient.from('posts').insert([{
            user_id:         user.id,
            post_type:       'review',
            title:           title,
            content:         content,
            rating:          rating,
            author_name:     profile ? (profile.nickname || '의뢰자') : '의뢰자',
            author_type:     profile ? profile.user_type : '',
            request_id:      data.requestId,
            manufacturer_id: data.manufacturerId,
            bid_id:          data.bidId || null
        }]).select().single();
        if (insertRes.error) throw insertRes.error;

        // 캐시 갱신 (실패해도 후기 등록은 성공으로 간주)
        try { await this.recomputeProfileStats(data.manufacturerId); }
        catch(e){ console.warn('평점 캐시 갱신 실패:', e.message); }

        // 생산자 알림
        try {
            await Notifications.create(
                data.manufacturerId,
                'review_received',
                '⭐ 새 후기가 등록되었습니다',
                '['+(reqRes.data.title||'의뢰')+'] ★'+rating+' — '+title,
                data.requestId
            );
        } catch(e){ console.warn('알림 실패:', e.message); }

        return insertRes.data;
    },

    // ── 의뢰별 후기 작성 여부 ──────────────────────────
    async hasReviewed(requestId) {
        var user = await Auth.getUser();
        if (!user || !requestId) return false;
        var res = await window.supabaseClient
            .from('posts')
            .select('id')
            .eq('post_type', 'review')
            .eq('user_id', user.id)
            .eq('request_id', requestId)
            .limit(1);
        return !res.error && res.data && res.data.length > 0;
    },

    // ── 생산자별 후기 목록 ────────────────────────────
    async getByManufacturer(manufacturerId, limit) {
        if (!manufacturerId) return [];
        var res = await window.supabaseClient
            .from('posts')
            .select('id, title, content, rating, author_name, created_at, request_id')
            .eq('post_type', 'review')
            .eq('manufacturer_id', manufacturerId)
            .order('created_at', { ascending: false })
            .limit(limit || 5);
        if (res.error) { console.error(res.error); return []; }
        return res.data || [];
    },

    // ── 생산자 평점/완료수 캐시 재계산 ─────────────────
    async recomputeProfileStats(manufacturerId) {
        if (!manufacturerId) return;

        // 후기 평균·개수
        var revRes = await window.supabaseClient
            .from('posts')
            .select('rating')
            .eq('post_type', 'review')
            .eq('manufacturer_id', manufacturerId);
        var rows = (revRes.data || []).filter(function(r){ return r.rating != null; });
        var totalReviews = rows.length;
        var avg = totalReviews
            ? rows.reduce(function(s,r){ return s + Number(r.rating); }, 0) / totalReviews
            : 0;
        avg = Math.round(avg * 100) / 100;

        // 완료 거래 건수: 본인이 selected된 입찰의 의뢰가 completed
        var completedCount = 0;
        var bidsRes = await window.supabaseClient
            .from('bids')
            .select('requests(status)')
            .eq('manufacturer_id', manufacturerId)
            .eq('status', 'selected');
        if (!bidsRes.error) {
            completedCount = (bidsRes.data || []).filter(function(b){
                return b.requests && b.requests.status === 'completed';
            }).length;
        }

        await window.supabaseClient
            .from('profiles')
            .update({
                avg_rating:      avg,
                total_reviews:   totalReviews,
                completed_count: completedCount
            })
            .eq('id', manufacturerId);

        return { avg: avg, totalReviews: totalReviews, completedCount: completedCount };
    }
};

window.Reviews = Reviews;
console.log('✅ Reviews 모듈 로드 완료');
