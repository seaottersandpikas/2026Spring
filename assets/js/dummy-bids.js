// =====================================================
// 더미 입찰 자동 생성 모듈 (DB 기반)
// =====================================================

var DummyBids = {

    // DB에서 카테고리에 맞는 생산자 조회
    async getManufacturersByCategory(category) {
        var res = await window.supabaseClient
            .from('manufacturers')
            .select('*')
            .contains('categories', [category])
            .eq('is_active', true)
            .order('rating', { ascending: false });

        if (res.error) {
            console.error('생산자 조회 오류:', res.error);
            return [];
        }
        return res.data || [];
    },

    // 이름으로 생산자 정보 조회 (캐시 활용)
    _cache: {},
    async getMakerByName(name) {
        if (this._cache[name]) return this._cache[name];
        var res = await window.supabaseClient
            .from('manufacturers')
            .select('*')
            .eq('name', name)
            .single();
        if (res.data) this._cache[name] = res.data;
        return res.data || { name: name, specialty: '종합 굿즈', rating: 4.5, completed_count: 0 };
    },

    randInt: function(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    // 단가 계산 (100원 단위 반올림)
    calcPrice: function(targetPrice, ratio) {
        return Math.round(targetPrice * ratio / 100) * 100;
    },

    // 의뢰에 더미 입찰 생성
    async generateBids(requestId, category, targetPrice, quantity) {
        // 해당 카테고리 생산자 조회
        var makers = await this.getManufacturersByCategory(category);

        if (makers.length === 0) {
            // 카테고리 매칭 없으면 전체에서 랜덤
            var fallback = await window.supabaseClient
                .from('manufacturers')
                .select('*')
                .eq('is_active', true)
                .limit(5);
            makers = fallback.data || [];
        }

        if (makers.length === 0) {
            console.warn('생산자 데이터 없음');
            return [];
        }

        // 3~5개 랜덤 선택
        var count   = this.randInt(3, Math.min(5, makers.length));
        var shuffled = makers.slice().sort(function(){ return Math.random() - 0.5; });
        var selected = shuffled.slice(0, count);

        // 가격 배열 생성 (낮은 순 정렬)
        var prices = selected.map(function(maker) {
            var ratio = maker.price_ratio_min +
                Math.random() * (maker.price_ratio_max - maker.price_ratio_min);
            return DummyBids.calcPrice(targetPrice, ratio);
        });
        prices.sort(function(a, b){ return a - b; });

        // 가격 중복 방지 (최소 100원 차이)
        for (var j = 1; j < prices.length; j++) {
            if (prices[j] <= prices[j-1]) prices[j] = prices[j-1] + 100;
        }

        // 가격 낮은 순으로 생산자 배정
        selected.sort(function(a, b){ return b.rating - a.rating; });

        var noteTemplates = [
            '샘플 1개 무료 제공, 고품질 보장',
            '빠른 납기 가능, 품질 검수 철저',
            '대량 추가 할인 가능, 재구매 시 우대',
            '디자인 수정 1회 무료, 납품 후 AS 보장',
            '친환경 소재 사용 가능, 개별 포장 포함'
        ];

        var bidsToInsert = selected.map(function(maker, i) {
            return {
                request_id:              requestId,
                manufacturer_id:         null,
                manufacturer_name:       maker.name,
                manufacturer_rating:     maker.rating,
                manufacturer_specialty:  maker.specialty,
                manufacturer_completed:  maker.completed_count,
                unit_price:              prices[i],
                total_price:             prices[i] * quantity,
                delivery_days:           DummyBids.randInt(maker.delivery_min, maker.delivery_max),
                note:                    maker.note_template || noteTemplates[i % noteTemplates.length],
                status:                  'pending'
            };
        });

        var res = await window.supabaseClient
            .from('bids')
            .insert(bidsToInsert)
            .select();

        if (res.error) {
            console.error('더미 입찰 생성 오류:', res.error);
            throw res.error;
        }

        console.log('✅ 더미 입찰 ' + res.data.length + '건 생성 완료 (카테고리: ' + category + ')');
        return res.data;
    }
};

window.DummyBids = DummyBids;
console.log('✅ DummyBids 모듈 로드 완료');
