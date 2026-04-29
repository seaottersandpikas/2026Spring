// =====================================================
// 더미 입찰 자동 생성 모듈
// 의뢰 생성 시 카테고리에 맞는 생산자들이 자동으로 입찰
// =====================================================

var DummyBids = {

    // 카테고리별 생산자 데이터
    manufacturers: {
        '아크릴굿즈': [
            { id: '11111111-1111-1111-1111-111111111111', name: '프린트마스터', rating: 4.9, completedCount: 312, specialty: '아크릴 전문' },
            { id: '44444444-4444-4444-4444-444444444444', name: '아크릴킹',     rating: 4.8, completedCount: 245, specialty: '아크릴 전문' },
            { id: '22222222-2222-2222-2222-222222222222', name: '메이커스공방', rating: 4.7, completedCount: 189, specialty: '아크릴/의류' },
            { id: '33333333-3333-3333-3333-333333333333', name: '굿즈팩토리',   rating: 4.5, completedCount: 98,  specialty: '종합 굿즈' },
            { id: '66666666-6666-6666-6666-666666666666', name: '에코프린트',   rating: 4.3, completedCount: 67,  specialty: '종합 굿즈' }
        ],
        '의류/패브릭': [
            { id: '22222222-2222-2222-2222-222222222222', name: '메이커스공방', rating: 4.8, completedCount: 156, specialty: '패브릭 전문' },
            { id: '66666666-6666-6666-6666-666666666666', name: '에코프린트',   rating: 4.7, completedCount: 203, specialty: '의류 전문' },
            { id: '33333333-3333-3333-3333-333333333333', name: '굿즈팩토리',   rating: 4.5, completedCount: 134, specialty: '종합 굿즈' },
            { id: '11111111-1111-1111-1111-111111111111', name: '프린트마스터', rating: 4.4, completedCount: 89,  specialty: '인쇄 전문' },
            { id: '88888888-8888-8888-8888-888888888888', name: '봉제달인',     rating: 4.9, completedCount: 421, specialty: '봉제 전문' }
        ],
        '문구/스티커': [
            { id: '77777777-7777-7777-7777-777777777777', name: '스티커나라',   rating: 4.9, completedCount: 567, specialty: '스티커 전문' },
            { id: '11111111-1111-1111-1111-111111111111', name: '프린트마스터', rating: 4.8, completedCount: 312, specialty: '인쇄 전문' },
            { id: '33333333-3333-3333-3333-333333333333', name: '굿즈팩토리',   rating: 4.6, completedCount: 178, specialty: '종합 굿즈' },
            { id: '22222222-2222-2222-2222-222222222222', name: '메이커스공방', rating: 4.4, completedCount: 95,  specialty: '종합 굿즈' },
            { id: '66666666-6666-6666-6666-666666666666', name: '에코프린트',   rating: 4.3, completedCount: 72,  specialty: '인쇄 전문' }
        ],
        '패키징': [
            { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: '패키지마스터', rating: 4.9, completedCount: 289, specialty: '패키징 전문' },
            { id: '33333333-3333-3333-3333-333333333333', name: '굿즈팩토리',   rating: 4.7, completedCount: 143, specialty: '종합 굿즈' },
            { id: '66666666-6666-6666-6666-666666666666', name: '에코프린트',   rating: 4.5, completedCount: 98,  specialty: '친환경 전문' },
            { id: '22222222-2222-2222-2222-222222222222', name: '메이커스공방', rating: 4.4, completedCount: 67,  specialty: '종합 굿즈' },
            { id: '11111111-1111-1111-1111-111111111111', name: '프린트마스터', rating: 4.2, completedCount: 45,  specialty: '인쇄 전문' }
        ],
        '봉제인형': [
            { id: '88888888-8888-8888-8888-888888888888', name: '봉제달인',     rating: 4.9, completedCount: 421, specialty: '봉제 전문' },
            { id: '22222222-2222-2222-2222-222222222222', name: '메이커스공방', rating: 4.6, completedCount: 134, specialty: '봉제/의류' },
            { id: '33333333-3333-3333-3333-333333333333', name: '굿즈팩토리',   rating: 4.4, completedCount: 89,  specialty: '종합 굿즈' },
            { id: '11111111-1111-1111-1111-111111111111', name: '프린트마스터', rating: 4.2, completedCount: 56,  specialty: '종합 굿즈' },
            { id: '66666666-6666-6666-6666-666666666666', name: '에코프린트',   rating: 4.1, completedCount: 34,  specialty: '종합 굿즈' }
        ],
        '금속/뱃지': [
            { id: '99999999-9999-9999-9999-999999999999', name: '메탈공방',     rating: 4.9, completedCount: 234, specialty: '금속 전문' },
            { id: '44444444-4444-4444-4444-444444444444', name: '아크릴킹',     rating: 4.7, completedCount: 156, specialty: '아크릴/금속' },
            { id: '33333333-3333-3333-3333-333333333333', name: '굿즈팩토리',   rating: 4.5, completedCount: 112, specialty: '종합 굿즈' },
            { id: '22222222-2222-2222-2222-222222222222', name: '메이커스공방', rating: 4.3, completedCount: 78,  specialty: '종합 굿즈' },
            { id: '11111111-1111-1111-1111-111111111111', name: '프린트마스터', rating: 4.1, completedCount: 45,  specialty: '종합 굿즈' }
        ],
        '생활용품': [
            { id: '33333333-3333-3333-3333-333333333333', name: '굿즈팩토리',   rating: 4.8, completedCount: 267, specialty: '생활용품 전문' },
            { id: '22222222-2222-2222-2222-222222222222', name: '메이커스공방', rating: 4.6, completedCount: 189, specialty: '종합 굿즈' },
            { id: '66666666-6666-6666-6666-666666666666', name: '에코프린트',   rating: 4.5, completedCount: 134, specialty: '친환경 전문' },
            { id: '11111111-1111-1111-1111-111111111111', name: '프린트마스터', rating: 4.3, completedCount: 98,  specialty: '인쇄 전문' },
            { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: '패키지마스터', rating: 4.2, completedCount: 67,  specialty: '패키징/생활' }
        ],
        '기타': [
            { id: '33333333-3333-3333-3333-333333333333', name: '굿즈팩토리',   rating: 4.7, completedCount: 312, specialty: '종합 굿즈' },
            { id: '22222222-2222-2222-2222-222222222222', name: '메이커스공방', rating: 4.6, completedCount: 245, specialty: '종합 굿즈' },
            { id: '11111111-1111-1111-1111-111111111111', name: '프린트마스터', rating: 4.5, completedCount: 189, specialty: '종합 굿즈' },
            { id: '66666666-6666-6666-6666-666666666666', name: '에코프린트',   rating: 4.3, completedCount: 134, specialty: '종합 굿즈' },
            { id: '44444444-4444-4444-4444-444444444444', name: '아크릴킹',     rating: 4.1, completedCount: 89,  specialty: '종합 굿즈' }
        ]
    },

    // 카테고리별 단가 범위
    priceRanges: {
        '아크릴굿즈':  { min: 0.75, max: 0.95 },
        '의류/패브릭': { min: 0.78, max: 0.96 },
        '문구/스티커': { min: 0.70, max: 0.92 },
        '패키징':      { min: 0.75, max: 0.93 },
        '봉제인형':    { min: 0.80, max: 0.97 },
        '금속/뱃지':   { min: 0.77, max: 0.95 },
        '생활용품':    { min: 0.76, max: 0.94 },
        '기타':        { min: 0.75, max: 0.95 }
    },

    // 납기일 범위 (일)
    deliveryRanges: {
        '아크릴굿즈':  { min: 5,  max: 14 },
        '의류/패브릭': { min: 7,  max: 21 },
        '문구/스티커': { min: 3,  max: 10 },
        '패키징':      { min: 5,  max: 14 },
        '봉제인형':    { min: 14, max: 30 },
        '금속/뱃지':   { min: 7,  max: 21 },
        '생활용품':    { min: 7,  max: 20 },
        '기타':        { min: 7,  max: 21 }
    },

    // 메모 템플릿
    noteTemplates: [
        '샘플 1개 무료 제공, 고품질 보장',
        '빠른 납기 가능, 품질 검수 철저',
        '대량 추가 할인 가능, 재구매 시 우대',
        '디자인 수정 1회 무료, 납품 후 AS 보장',
        '친환경 소재 사용 가능, 개별 포장 포함'
    ],

    // 단가 계산 (희망 단가 기준으로 ±범위 내 랜덤)
    calcPrice: function(targetPrice, ratio, index) {
        // index가 낮을수록 더 낮은 가격 (경쟁력 있게)
        var base = Math.round(targetPrice * ratio);
        // 100원 단위로 반올림
        return Math.round(base / 100) * 100;
    },

    // 랜덤 정수 생성
    randInt: function(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    // 의뢰에 대한 더미 입찰 생성
    async generateBids(requestId, category, targetPrice, quantity) {
        var makers = this.manufacturers[category] || this.manufacturers['기타'];
        var range  = this.priceRanges[category]   || { min: 0.75, max: 0.95 };
        var delRange = this.deliveryRanges[category] || { min: 7, max: 21 };

        // 3~5개 랜덤 입찰 생성
        var count = this.randInt(3, Math.min(5, makers.length));
        var selectedMakers = makers.slice(0, count);

        // 가격 배열 생성 (낮은 가격부터 높은 가격 순으로)
        var prices = [];
        for (var i = 0; i < count; i++) {
            // 첫 번째가 가장 낮고, 마지막이 가장 높게
            var ratio = range.min + (range.max - range.min) * (i / (count - 1));
            // 약간의 랜덤성 추가
            var jitter = (Math.random() - 0.5) * 0.03;
            ratio = Math.max(range.min, Math.min(range.max, ratio + jitter));
            prices.push(this.calcPrice(targetPrice, ratio, i));
        }

        // 가격 중복 방지 (최소 100원 차이)
        for (var j = 1; j < prices.length; j++) {
            if (prices[j] <= prices[j-1]) {
                prices[j] = prices[j-1] + 100;
            }
        }

        // 입찰 데이터 배열 생성
        var bidsToInsert = selectedMakers.map(function(maker, i) {
            return {
                request_id:        requestId,
                manufacturer_id:   maker.id,
                manufacturer_name: maker.name,
                unit_price:        prices[i],
                total_price:       prices[i] * quantity,
                delivery_days:     DummyBids.randInt(delRange.min, delRange.max),
                note:              maker.specialty + ' · ' + DummyBids.noteTemplates[i % DummyBids.noteTemplates.length],
                status:            'pending'
            };
        });

        // Supabase에 일괄 삽입
        var res = await window.supabaseClient
            .from('bids')
            .insert(bidsToInsert)
            .select();

        if (res.error) {
            console.error('더미 입찰 생성 오류:', res.error);
            throw res.error;
        }

        console.log('✅ 더미 입찰 ' + res.data.length + '건 생성 완료');
        return res.data;
    }
};

window.DummyBids = DummyBids;
console.log('✅ DummyBids 모듈 로드 완료');
