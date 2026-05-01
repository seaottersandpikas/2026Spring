var AppState = {
    currentUser:    null,
    currentProfile: null,
    bizCurrentStep: 1,
    pendingMatch:   {},
    priceHints: {
        '아크릴굿즈':'1,800~3,500원','의류/패브릭':'7,000~25,000원',
        '문구/스티커':'300~1,500원','패키징':'800~3,000원',
        '봉제인형':'10,000~30,000원','금속/뱃지':'2,000~5,000원',
        '생활용품':'3,000~15,000원'
    }
};

// ── 초기화 ─────────────────────────────────────────────
function initApp() {
    if (!window.supabaseClient) {
        showToast('연결 오류. 새로고침해주세요.', 'error');
        return;
    }
    console.log('✅ App 초기화');

    // 인증 상태 변경 → UI 즉시 반영
    Auth.onAuthStateChange(function(event, session) {
        console.log('🔔 Auth 이벤트:', event);
        if (event === 'SIGNED_IN' && session) {
            AppState.currentUser = session.user;
            // 프로필 비동기 로드 (UI 블로킹 없음)
            Auth.getProfile().then(function(p) {
                AppState.currentProfile = p;
                updateUILoggedIn();
            });
        } else if (event === 'SIGNED_OUT') {
            AppState.currentUser    = null;
            AppState.currentProfile = null;
            updateUILoggedOut();
        }
    });

    // 기존 세션 확인
    Auth.getUser().then(function(user) {
        if (user) {
            AppState.currentUser = user;
            Auth.getProfile().then(function(p) {
                AppState.currentProfile = p;
                updateUILoggedIn();
            });
        }
    });

    // 매칭 이력 로드
    loadMatchHistoryBiz();
    loadMatchHistoryPersonal();

    // 카테고리 힌트
    var bizCat = document.getElementById('biz-category');
    if (bizCat) {
        bizCat.addEventListener('change', function() {
            var hint = AppState.priceHints[this.value];
            var el   = document.getElementById('biz-price-hint');
            if (el) el.textContent = hint
                ? '시장 평균 참고가: ' + hint
                : '카테고리를 선택하면 표시됩니다';
        });
    }

    // 모달 오버레이 클릭 닫기
    document.querySelectorAll('.modal-overlay').forEach(function(o) {
        o.addEventListener('click', function(e) {
            if (e.target === this) this.classList.remove('show');
        });
    });
}

// ── UI ─────────────────────────────────────────────────
function updateUILoggedIn() {
    var p     = AppState.currentProfile;
    var name  = (p && p.nickname) ? p.nickname : '사용자';
    var email = (p && p.email)    ? p.email    : '';
    var loginBtn = document.getElementById('loginNavBtn');
    var avatar   = document.getElementById('userAvatar');
    if (loginBtn) loginBtn.style.display = 'none';
    if (avatar)  { avatar.style.display = 'flex'; avatar.textContent = name[0].toUpperCase(); }
    setEl('profileName',           name);
    setEl('profileEmail',          email);
    setEl('biz-sidebar-name',      name);
    setEl('personal-sidebar-name', name);
    // 로그인 후 현재 활성 페이지가 의뢰 페이지면 즉시 로드
    var bizPage = document.getElementById('page-client-business');
    var perPage = document.getElementById('page-client-personal');
    if (bizPage && bizPage.classList.contains('active')) loadBizDashboard();
    if (perPage && perPage.classList.contains('active')) loadPersonalDashboard();
}

function updateUILoggedOut() {
    var loginBtn = document.getElementById('loginNavBtn');
    var avatar   = document.getElementById('userAvatar');
    if (loginBtn) loginBtn.style.display = 'flex';
    if (avatar)   avatar.style.display   = 'none';
    // 프로필 드롭다운도 닫기
    var dd = document.getElementById('profileDropdown');
    if (dd) dd.classList.remove('show');
}

// ── 로그인 ─────────────────────────────────────────────
async function handleLogin() {
    var email    = document.getElementById('loginEmail').value.trim();
    var password = document.getElementById('loginPassword').value;
    if (!email || !password) { showToast('이메일과 비밀번호를 입력하세요.', 'error'); return; }

    var btn = document.getElementById('loginSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = '로그인 중...'; }

    try {
        await Auth.signIn(email, password);
        // onAuthStateChange → SIGNED_IN 이벤트가 UI 처리
        closeModal('loginModal');
        document.getElementById('loginEmail').value    = '';
        document.getElementById('loginPassword').value = '';
        showToast('로그인되었습니다! 😊', 'success');
    } catch(e) {
        var msg = e.message || '';
        if (msg.includes('Invalid login credentials')) msg = '이메일 또는 비밀번호가 올바르지 않습니다.';
        else if (msg.includes('Email not confirmed'))  msg = '이메일 인증이 필요합니다.';
        else if (msg.includes('Too many requests'))    msg = '잠시 후 다시 시도해주세요.';
        showToast('로그인 실패: ' + msg, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '로그인'; }
    }
}

// ── 회원가입 ───────────────────────────────────────────
async function handleSignUp() {
    var email    = document.getElementById('signupEmail').value.trim();
    var password = document.getElementById('signupPassword').value;
    var nickname = document.getElementById('signupNickname').value.trim();
    var userType = document.getElementById('signupUserType').value;
    if (!email||!password||!nickname||!userType) { showToast('모든 항목을 입력해주세요.','error'); return; }
    if (password.length < 6) { showToast('비밀번호는 6자 이상이어야 합니다.','error'); return; }
    var btn = document.getElementById('signupSubmitBtn');
    if (btn) { btn.disabled=true; btn.textContent='가입 중...'; }
    try {
        await Auth.signUp(email, password, nickname, userType);
        closeModal('signupModal');
        showToast('회원가입 완료! 이메일 인증 후 로그인해주세요.','success');
    } catch(e) {
        showToast('회원가입 실패: '+e.message,'error');
    } finally {
        if (btn) { btn.disabled=false; btn.textContent='회원가입'; }
    }
}

// ── 로그아웃 (즉시 처리) ───────────────────────────────
async function handleLogout() {
    // 1. 즉시 UI 업데이트 (사용자가 바로 느낌)
    AppState.currentUser    = null;
    AppState.currentProfile = null;
    updateUILoggedOut();
    navigateTo('home');
    showToast('로그아웃 되었습니다.', 'success');

    // 2. 백그라운드에서 실제 로그아웃
    try { await Auth.signOut(); } catch(e) { console.warn('signOut 경고:', e.message); }
}

// ── 네비게이션 ─────────────────────────────────────────
function navigateTo(page) {
    document.querySelectorAll('.page-section').forEach(function(el){ el.classList.remove('active'); });
    var t = document.getElementById('page-'+page);
    if (t) t.classList.add('active');
    document.querySelectorAll('#mainNav button').forEach(function(b){ b.classList.remove('active'); });
    var map = {home:0,'client-select':1,'client-business':1,'client-personal':1,marketplace:2};
    if (map[page] !== undefined) {
        var btns = document.querySelectorAll('#mainNav button');
        if (btns[map[page]]) btns[map[page]].classList.add('active');
    }
    // 페이지 진입 시 데이터 즉시 로드
    if (page === 'client-business') loadBizDashboard();
    if (page === 'client-personal') loadPersonalDashboard();
    window.scrollTo(0,0);
}

// ── 탭 ─────────────────────────────────────────────────
function showBizTab(tab, btn) {
    document.querySelectorAll('#page-client-business .main-content > .tab-content')
        .forEach(function(el){ el.classList.remove('active'); });
    var el = document.getElementById('biz-'+tab);
    if (el) el.classList.add('active');
    document.querySelectorAll('#page-client-business .sidebar-menu button')
        .forEach(function(b){ b.classList.remove('active'); });
    if (btn) { btn.classList.add('active'); }
    else {
        var m = {dashboard:0,create:1,manage:2,'recent-match':3,payments:4};
        var bs = document.querySelectorAll('#page-client-business .sidebar-menu button');
        if (bs[m[tab]]) bs[m[tab]].classList.add('active');
    }
    if (tab==='manage')       loadMyRequests('business');
    if (tab==='recent-match') loadMatchHistoryBiz();
    if (tab==='dashboard')    loadBizDashboard();
}

function showPersonalTab(tab, btn) {
    document.querySelectorAll('#page-client-personal .main-content > .tab-content')
        .forEach(function(el){ el.classList.remove('active'); });
    var el = document.getElementById('personal-'+tab);
    if (el) el.classList.add('active');
    document.querySelectorAll('#page-client-personal .sidebar-menu button')
        .forEach(function(b){ b.classList.remove('active'); });
    if (btn) { btn.classList.add('active'); }
    else {
        var m = {dashboard:0,individual:1,group:2,myorders:3,'recent-match':4,payments:5};
        var bs = document.querySelectorAll('#page-client-personal .sidebar-menu button');
        if (bs[m[tab]]) bs[m[tab]].classList.add('active');
    }
    if (tab==='myorders')     loadMyRequests('personal');
    if (tab==='recent-match') loadMatchHistoryPersonal();
    if (tab==='dashboard')    loadPersonalDashboard();
}

// ── 대시보드 ───────────────────────────────────────────
async function loadBizDashboard() {
    if (!AppState.currentUser) return;
    try {
        var r = await Requests.getMyRequests();
        var b = r.filter(function(x){ return x.request_type==='business'; });
        setEl('biz-count-all',       b.length);
        setEl('biz-count-bidding',   b.filter(function(x){ return x.status==='bidding'; }).length);
        setEl('biz-count-producing', b.filter(function(x){ return x.status==='producing'; }).length);
        setEl('biz-count-completed', b.filter(function(x){ return x.status==='matched'||x.status==='producing'||x.status==='shipping'||x.status==='completed'; }).length);
    } catch(e){ console.error(e); }
}

async function loadPersonalDashboard() {
    if (!AppState.currentUser) return;
    try {
        var r = await Requests.getMyRequests();
        var p = r.filter(function(x){ return x.request_type==='personal'||x.request_type==='group'; });
        setEl('per-count-all',       p.length);
        setEl('per-count-bidding',   p.filter(function(x){ return x.status==='bidding'&&x.request_type==='personal'; }).length);
        setEl('per-count-group',     p.filter(function(x){ return x.request_type==='group'; }).length);
        setEl('per-count-completed', p.filter(function(x){ return x.status==='matched'||x.status==='producing'||x.status==='shipping'||x.status==='completed'; }).length);
    } catch(e){ console.error(e); }
}

// ── 의뢰 목록 ──────────────────────────────────────────
async function loadMyRequests(type) {
    var cid       = type==='business' ? 'biz-manage-list' : 'personal-myorders-list';
    var container = document.getElementById(cid);
    if (!container) return;

    if (!AppState.currentUser) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔐</div><p>로그인 후 확인할 수 있습니다.</p><button class="btn btn-primary" onclick="openModal(\'loginModal\')">로그인</button></div>';
        return;
    }
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>로딩 중...</p></div>';

    try {
        var all  = await Requests.getMyRequests();
        var list = all.filter(function(r){
            return type==='business'
                ? r.request_type==='business'
                : (r.request_type==='personal'||r.request_type==='group');
        });
        if (!list.length) {
            var fn = type==='business' ? "showBizTab('create',null)" : "showPersonalTab('individual',null)";
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>아직 등록된 의뢰가 없습니다.</p><button class="btn btn-primary" onclick="'+fn+'">첫 의뢰 만들기</button></div>';
            return;
        }
        container.innerHTML = list.map(renderRequestCard).join('');
    } catch(e) {
        console.error(e);
        container.innerHTML = '<div class="empty-state"><p>오류: '+escHtml(e.message)+'</p></div>';
    }
}

// ── 카드 렌더링 ────────────────────────────────────────
function renderRequestCard(req) {
    var sMap = {
        draft:    {label:'임시저장',    cls:'status-draft'},
        bidding:  {label:'입찰중',      cls:'status-bidding'},
        matched:  {label:'매칭완료',    cls:'status-matched'},
        producing:{label:'제작 진행중', cls:'status-producing'},
        shipping: {label:'배송중',      cls:'status-shipping'},
        completed:{label:'배송 완료',   cls:'status-completed'},
        cancelled:{label:'취소됨',      cls:'status-draft'}
    };
    var s        = sMap[req.status] || {label:req.status, cls:''};
    var bids     = req.bids ? req.bids.slice().sort(function(a,b){return a.unit_price-b.unit_price;}) : [];
    var bidCount = bids.length;
    var created  = new Date(req.created_at).toLocaleDateString('ko-KR');
    var ddText   = '';
    if (req.bid_deadline) {
        var diff = Math.ceil((new Date(req.bid_deadline)-new Date())/86400000);
        ddText = req.bid_deadline+(diff>=0?' (D-'+diff+')':' (마감)');
    }

    // 입찰 현황
    var bidsHtml = '';
    if (req.status==='bidding' && bidCount>0) {
        var rc = ['gold','silver','bronze'];
        bidsHtml = '<div class="divider"></div>' +
            '<h5 class="mb-8">📊 입찰 현황 ('+bidCount+'건) <span class="text-xs text-muted">· 클릭하면 견적 확인</span></h5>' +
            bids.slice(0,3).map(function(bid,i){
                var mk = getMakerInfo(bid);
                return '<div class="bid-item '+(i===0?'top-bid':'')+'" onclick="openBidDetail(\''+bid.id+'\',\''+req.id+'\')" style="cursor:pointer">' +
                    '<div class="bid-info">' +
                    '<div class="bid-rank '+(rc[i]||'')+'">'+(i+1)+'</div>' +
                    '<div><strong>'+escHtml(bid.manufacturer_name||'생산자')+'</strong>' +
                    '<p class="text-xs text-muted">'+escHtml(mk.specialty)+' | ⭐'+mk.rating+' | '+mk.completedCount+'건 완료</p>' +
                    '</div></div>' +
                    '<div style="display:flex;align-items:center;gap:12px">' +
                    '<div><div class="bid-price">'+bid.unit_price.toLocaleString()+'원</div>' +
                    '<div class="text-xs text-muted">납기 '+(bid.delivery_days||'-')+'일</div></div>' +
                    (i===0
                        ? '<button class="btn btn-success btn-sm" onclick="event.stopPropagation();confirmSelectBid(\''+req.id+'\',\''+bid.id+'\',\''+escHtml(bid.manufacturer_name||'')+'\',' +bid.unit_price+')">✓ 선택</button>'
                        : '<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();confirmSelectBid(\''+req.id+'\',\''+bid.id+'\',\''+escHtml(bid.manufacturer_name||'')+'\',' +bid.unit_price+')">Override</button>'
                    ) +
                    '</div></div>';
            }).join('');
        if (bidCount>3) bidsHtml += '<p class="text-xs mt-8" style="text-align:center;cursor:pointer;color:var(--primary)" onclick="openRequestDetail(\''+req.id+'\')">' +(bidCount-3)+'건 더 보기 →</p>';
        bidsHtml += '<p class="text-xs text-muted mt-8">⚠️ 마감일 경과 시 최저가 입찰자에게 자동 매칭됩니다.</p>';
    } else if (req.status==='bidding') {
        bidsHtml = '<div class="alert alert-info" style="margin-top:12px"><span>⏳</span><span>입찰 준비 중입니다.</span></div>';
    }

    // 매칭 완료 상태 표시
    var matchedHtml = '';
    if (req.status==='matched'||req.status==='producing'||req.status==='shipping'||req.status==='completed') {
        var selectedBid = req.bids ? req.bids.find(function(b){return b.status==='selected';}) : null;
        if (selectedBid) {
            matchedHtml = '<div class="alert alert-success" style="margin-top:12px">' +
                '<span>✅</span>' +
                '<div><strong>'+escHtml(selectedBid.manufacturer_name)+'</strong> 와 매칭되었습니다.<br>' +
                '<span class="text-sm">확정 단가: <strong>'+selectedBid.unit_price.toLocaleString()+'원</strong> | 납기: '+(selectedBid.delivery_days||'-')+'일</span>' +
                '</div></div>';
        }
    }

    // 공동구매
    var groupHtml = '';
    if (req.request_type==='group' && req.min_quantity) {
        var pct = Math.min(100,Math.round((req.current_quantity||0)/req.min_quantity*100));
        groupHtml = '<div class="co-purchase-info">' +
            '<div class="flex-between"><span>모집 현황</span><strong>'+(req.current_quantity||0)+' / '+req.min_quantity+'개 (최소)</strong></div>' +
            '<div class="progress-bar mt-8"><div class="fill" style="width:'+pct+'%"></div></div>' +
            '<p class="text-xs text-muted mt-8">최소 수량까지 '+Math.max(0,req.min_quantity-(req.current_quantity||0))+'개 남음</p>' +
            '</div>';
    }

    return '<div class="request-card" data-status="'+req.status+'" data-request-type="'+req.request_type+'" data-id="'+req.id+'">' +
        '<div class="request-card-header">' +
        '<h4>'+(req.request_type==='group'?'👥 ':'')+escHtml(req.title)+'</h4>' +
        '<span class="status-badge '+s.cls+'">'+s.label+(req.status==='bidding'?' ('+bidCount+'명)':'')+'</span>' +
        '</div>' +
        '<div class="request-meta">' +
        '<div class="meta-item">📦 수량: <strong>'+req.quantity.toLocaleString()+'개</strong></div>' +
        '<div class="meta-item">💰 희망 단가: <strong>'+req.target_price.toLocaleString()+'원</strong></div>' +
        (ddText?'<div class="meta-item">📅 마감: <strong>'+ddText+'</strong></div>':'')+
        '<div class="meta-item">🗓 등록: <strong>'+created+'</strong></div>' +
        '</div>' +
        groupHtml + bidsHtml + matchedHtml +
        '<div class="request-actions">' +
        '<button class="btn btn-sm btn-secondary" onclick="openRequestDetail(\''+req.id+'\')">📋 상세 보기</button>' +
        (req.status==='bidding'?'<button class="btn btn-sm btn-danger" onclick="cancelRequest(\''+req.id+'\')">취소</button>':'')+
        (req.status==='completed'?'<button class="btn btn-sm btn-primary" onclick="openModal(\'writeReviewModal\')">✍️ 후기 작성</button>':'')+
        '</div></div>';
}

// ── 생산자 정보 헬퍼 ───────────────────────────────────
function getMakerInfo(bid) {
    return {
        specialty:      bid.manufacturer_specialty || '종합 굿즈',
        rating:         bid.manufacturer_rating    || '4.5',
        completedCount: bid.manufacturer_completed || '-'
    };
}

// ── 입찰 상세 ──────────────────────────────────────────
async function openBidDetail(bidId, requestId) {
    openModal('requestDetailModal');
    var body    = document.getElementById('detail-modal-body');
    var titleEl = document.getElementById('detail-modal-title');
    if (body) body.innerHTML = '<div style="text-align:center;padding:40px"><div style="font-size:32px">⏳</div><p>로딩 중...</p></div>';
    try {
        var req  = await Requests.getById(requestId);
        if (!req) throw new Error('의뢰 정보를 찾을 수 없습니다.');
        var bids = req.bids ? req.bids.slice().sort(function(a,b){return a.unit_price-b.unit_price;}) : [];
        var bid  = bids.find(function(b){return b.id===bidId;});
        if (!bid) throw new Error('입찰 정보를 찾을 수 없습니다.');
        var mk   = getMakerInfo(bid);
        var rank = bids.findIndex(function(b){return b.id===bidId;})+1;
        if (titleEl) titleEl.textContent = '📄 '+escHtml(bid.manufacturer_name)+' 견적서';

        body.innerHTML =
            '<div style="display:flex;align-items:center;gap:12px;background:var(--bg);padding:14px;border-radius:8px;margin-bottom:16px">' +
            '<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:16px">'+escHtml(bid.manufacturer_name[0])+'</div>' +
            '<div><div style="font-weight:700;font-size:15px">'+escHtml(bid.manufacturer_name)+'</div>' +
            '<div class="text-xs text-muted">'+escHtml(mk.specialty)+' | ⭐'+mk.rating+' | 완료 '+mk.completedCount+'건</div></div>' +
            (rank===1?'<span class="status-badge status-matched" style="margin-left:auto">🏆 최저가</span>':'<span class="status-badge status-bidding" style="margin-left:auto">'+rank+'위</span>')+
            '</div>' +
            '<table class="estimate-table">' +
            '<thead><tr><th>항목</th><th>수량</th><th>단가</th><th>금액</th></tr></thead>' +
            '<tbody>' +
            '<tr><td>'+escHtml(req.title)+' 제작비</td><td>'+req.quantity.toLocaleString()+'개</td><td>'+bid.unit_price.toLocaleString()+'원</td><td>'+(bid.unit_price*req.quantity).toLocaleString()+'원</td></tr>' +
            '<tr><td>포장비</td><td>포함</td><td>-</td><td>-</td></tr>' +
            '<tr><td>배송비</td><td>-</td><td>-</td><td>무료</td></tr>' +
            '</tbody>' +
            '<tfoot><tr style="font-weight:700"><td colspan="3" style="text-align:right">합계</td><td class="text-primary">'+(bid.unit_price*req.quantity).toLocaleString()+'원</td></tr></tfoot>' +
            '</table>' +
            (bid.note?'<div class="alert alert-info mt-16"><span>📝</span><span><strong>생산자 메모:</strong> '+escHtml(bid.note)+'</span></div>':'')+
            '<div style="background:var(--bg);border-radius:8px;padding:12px 16px;margin-top:12px;display:flex;gap:24px;flex-wrap:wrap">' +
            '<div><div class="text-xs text-muted">예상 납기</div><div style="font-weight:700;font-size:16px;color:var(--primary)">'+(bid.delivery_days||'-')+'일</div></div>' +
            '<div><div class="text-xs text-muted">희망 단가 대비</div><div style="font-weight:700;font-size:16px;color:var(--success)">▼'+Math.max(0,Math.round((1-bid.unit_price/req.target_price)*100))+'% 절감</div></div>' +
            '<div><div class="text-xs text-muted">총 결제 예정액</div><div style="font-weight:700;font-size:16px">'+(bid.unit_price*req.quantity).toLocaleString()+'원</div></div>' +
            '</div>' +
            '<div class="divider"></div>' +
            '<h5 style="margin-bottom:10px">다른 입찰 비교 (단가 낮은 순)</h5>' +
            '<div style="display:flex;flex-direction:column;gap:6px">' +
            bids.map(function(b,i){
                var isThis = b.id===bidId;
                return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:'+(isThis?'rgba(108,92,231,0.08)':'var(--bg)')+';border-radius:6px;border:'+(isThis?'1px solid var(--primary-light)':'1px solid transparent')+'">' +
                    '<span class="text-sm"><strong>'+(i+1)+'위</strong> '+escHtml(b.manufacturer_name)+'</span>' +
                    '<div style="display:flex;align-items:center;gap:12px">' +
                    '<span style="font-weight:700;color:var(--primary)">'+b.unit_price.toLocaleString()+'원</span>' +
                    '<span class="text-xs text-muted">납기 '+(b.delivery_days||'-')+'일</span>' +
                    (isThis
                        ? '<span class="text-xs" style="color:var(--primary);font-weight:600">현재 보는 중</span>'
                        : '<button class="btn btn-outline btn-sm" onclick="openBidDetail(\''+b.id+'\',\''+requestId+'\')">보기</button>'
                    )+
                    '</div></div>';
            }).join('')+
            '</div>' +
            '<div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px">' +
            '<button class="btn btn-secondary" onclick="closeModal(\'requestDetailModal\')">닫기</button>' +
            (req.status==='bidding'?'<button class="btn btn-success" onclick="closeModal(\'requestDetailModal\');confirmSelectBid(\''+req.id+'\',\''+bid.id+'\',\''+escHtml(bid.manufacturer_name)+'\',' +bid.unit_price+')">이 견적으로 매칭 →</button>':'')+
            '</div>';
    } catch(e) {
        console.error(e);
        if (body) body.innerHTML = '<div class="empty-state"><p>오류: '+escHtml(e.message)+'</p></div>';
    }
}

// ── 의뢰 상세 ──────────────────────────────────────────
async function openRequestDetail(requestId) {
    openModal('requestDetailModal');
    var body    = document.getElementById('detail-modal-body');
    var titleEl = document.getElementById('detail-modal-title');
    if (body) body.innerHTML = '<div style="text-align:center;padding:40px"><div style="font-size:32px">⏳</div><p>로딩 중...</p></div>';
    try {
        var req = await Requests.getById(requestId);
        if (!req) throw new Error('의뢰를 찾을 수 없습니다.');
        if (titleEl) titleEl.textContent = '📋 '+req.title;
        var sMap={draft:'임시저장',bidding:'입찰중',matched:'매칭완료',producing:'제작 진행중',shipping:'배송중',completed:'배송 완료',cancelled:'취소됨'};
        var tMap={business:'사업자 의뢰',personal:'개인 의뢰',group:'공동구매 의뢰'};
        var bids  = req.bids ? req.bids.slice().sort(function(a,b){return a.unit_price-b.unit_price;}) : [];
        var files = req.request_files||[];

        var bidsSection = bids.length>0
            ? '<div class="divider"></div><h5 style="margin-bottom:12px">📊 전체 입찰 목록 ('+bids.length+'건)</h5>' +
              bids.map(function(bid,i){
                  var mk=getMakerInfo(bid), rc=['gold','silver','bronze'];
                  return '<div class="bid-item '+(i===0?'top-bid':'')+'" onclick="openBidDetail(\''+bid.id+'\',\''+req.id+'\')" style="cursor:pointer">' +
                      '<div class="bid-info"><div class="bid-rank '+(rc[i]||'')+'">'+(i+1)+'</div>' +
                      '<div><strong>'+escHtml(bid.manufacturer_name||'생산자')+'</strong>' +
                      '<p class="text-xs text-muted">'+escHtml(mk.specialty)+' | ⭐'+mk.rating+' | 완료 '+mk.completedCount+'건</p></div></div>' +
                      '<div style="display:flex;align-items:center;gap:12px">' +
                      '<div><div class="bid-price">'+bid.unit_price.toLocaleString()+'원</div>' +
                      '<div class="text-xs text-muted">납기 '+(bid.delivery_days||'-')+'일 · 총 '+(bid.unit_price*req.quantity).toLocaleString()+'원</div></div>' +
                      (req.status==='bidding'
                          ?(i===0
                              ?'<button class="btn btn-success btn-sm" onclick="event.stopPropagation();closeModal(\'requestDetailModal\');confirmSelectBid(\''+req.id+'\',\''+bid.id+'\',\''+escHtml(bid.manufacturer_name||'')+'\',' +bid.unit_price+')">✓ 선택</button>'
                              :'<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();closeModal(\'requestDetailModal\');confirmSelectBid(\''+req.id+'\',\''+bid.id+'\',\''+escHtml(bid.manufacturer_name||'')+'\',' +bid.unit_price+')">Override</button>'
                          ):'')+
                      '</div></div>';
              }).join('')
            : '<div class="divider"></div><div class="alert alert-info"><span>⏳</span><span>아직 입찰한 생산자가 없습니다.</span></div>';

        var filesSection = files.length>0
            ? '<div class="divider"></div><h5 style="margin-bottom:8px">📎 첨부 파일</h5>'+
              files.map(function(f){return '<div style="padding:8px 12px;background:var(--bg);border-radius:6px;margin-bottom:4px;font-size:13px"><a href="'+f.file_url+'" target="_blank" style="color:var(--primary)">📎 '+escHtml(f.file_name)+'</a></div>';}).join('')
            : '';

        body.innerHTML =
            '<table class="data-table mb-16">' +
            '<tr><td style="width:120px;font-weight:600">의뢰 유형</td><td>'+(tMap[req.request_type]||req.request_type)+'</td></tr>' +
            '<tr><td style="font-weight:600">카테고리</td><td>'+escHtml(req.category)+'</td></tr>' +
            '<tr><td style="font-weight:600">수량</td><td>'+req.quantity.toLocaleString()+'개</td></tr>' +
            '<tr><td style="font-weight:600">희망 단가</td><td>'+req.target_price.toLocaleString()+'원</td></tr>' +
            '<tr><td style="font-weight:600">예상 총액</td><td class="text-primary fw-bold">'+(req.quantity*req.target_price).toLocaleString()+'원</td></tr>' +
            (req.bid_deadline?'<tr><td style="font-weight:600">입찰 마감일</td><td>'+req.bid_deadline+'</td></tr>':'')+
            '<tr><td style="font-weight:600">상태</td><td>'+(sMap[req.status]||req.status)+'</td></tr>' +
            '<tr><td style="font-weight:600">등록일</td><td>'+new Date(req.created_at).toLocaleString('ko-KR')+'</td></tr>' +
            (req.design_guide?'<tr><td style="font-weight:600">디자인 가이드</td><td style="white-space:pre-wrap">'+escHtml(req.design_guide)+'</td></tr>':'')+
            (req.detail_note?'<tr><td style="font-weight:600">상세 요청</td><td style="white-space:pre-wrap">'+escHtml(req.detail_note)+'</td></tr>':'')+
            '</table>'+bidsSection+filesSection+
            '<div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px">' +
            (req.status==='bidding'?'<button class="btn btn-danger btn-sm" onclick="closeModal(\'requestDetailModal\');cancelRequest(\''+req.id+'\')">의뢰 취소</button>':'')+
            '<button class="btn btn-secondary" onclick="closeModal(\'requestDetailModal\')">닫기</button>' +
            '</div>';
    } catch(e) {
        console.error(e);
        if (body) body.innerHTML = '<div class="empty-state"><p>오류: '+escHtml(e.message)+'</p></div>';
    }
}

// ── 매칭 이력 ──────────────────────────────────────────
async function loadMatchHistoryBiz() {
    var tbody=document.getElementById('biz-match-tbody'); if(!tbody)return;
    try {
        var list=await Requests.getMatchHistory('business',20);
        if(!list.length){tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--gray)">매칭 이력이 없습니다.</td></tr>';return;}
        tbody.innerHTML=list.map(function(h){
            var sv=h.target_price>0?Math.round((1-h.matched_price/h.target_price)*100):0;
            return '<tr><td><strong>'+escHtml(h.title)+'</strong></td><td>'+(h.category||'-')+'</td><td>'+(h.quantity||0).toLocaleString()+'개</td><td>'+(h.target_price||0).toLocaleString()+'원</td><td class="text-success fw-bold">'+(h.matched_price||0).toLocaleString()+'원</td><td class="text-success">▼'+sv+'%</td><td>'+new Date(h.matched_at).toLocaleDateString('ko-KR')+'</td></tr>';
        }).join('');
    }catch(e){console.error(e);}
}

async function loadMatchHistoryPersonal() {
    var tbody=document.getElementById('personal-match-tbody'); if(!tbody)return;
    try {
        var list=await Requests.getMatchHistory(null,20);
        var f=list.filter(function(h){return h.request_type!=='business';});
        if(!f.length){tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray)">매칭 이력이 없습니다.</td></tr>';return;}
        var tMap={personal:'개인',group:'공동구매'};
        tbody.innerHTML=f.map(function(h){
            var cls=h.request_type==='group'?'status-recruiting':'status-completed';
            return '<tr><td><strong>'+escHtml(h.title)+'</strong></td><td>'+(h.quantity||0).toLocaleString()+'개</td><td>'+(h.target_price||0).toLocaleString()+'원</td><td class="text-success fw-bold">'+(h.matched_price||0).toLocaleString()+'원</td><td><span class="status-badge '+cls+'">'+(tMap[h.request_type]||h.request_type)+'</span></td><td>'+new Date(h.matched_at).toLocaleDateString('ko-KR')+'</td></tr>';
        }).join('');
    }catch(e){console.error(e);}
}

// ── 의뢰 생성 ──────────────────────────────────────────
async function submitBizRequest() {
    if (!AppState.currentUser) { openModal('loginModal'); return; }
    var btn = document.getElementById('biz-submit-btn');
    if (btn) { btn.disabled=true; btn.textContent='등록 중...'; }
    try {
        var category = document.getElementById('biz-category').value;
        var qty      = parseInt(document.getElementById('biz-qty').value);
        var price    = parseInt(document.getElementById('biz-price').value);
        var newReq   = await Requests.create({
            request_type: 'business',
            title:        document.getElementById('biz-title').value.trim(),
            category:     category, quantity: qty, target_price: price,
            bid_deadline: document.getElementById('biz-deadline').value||null,
            design_guide: document.getElementById('biz-design-guide').value,
            detail_note:  document.getElementById('biz-detail-note').value,
            status: 'bidding', bidding_type: 'bidding'
        });
        // 더미 입찰 생성 (실패해도 의뢰는 등록됨)
        try {
            await DummyBids.generateBids(newReq.id, category, price, qty);
            showToast('의뢰 등록 완료! 입찰이 도착했습니다 🎉', 'success');
        } catch(bidErr) {
            console.error('입찰 생성 오류:', bidErr);
            showToast('의뢰가 등록되었습니다. (입찰 생성 오류)', 'info');
        }
        resetBizForm();
        // 즉시 목록 갱신
        showBizTab('manage', null);
        loadBizDashboard();
    } catch(e) {
        showToast('오류: '+e.message, 'error');
    } finally {
        if (btn) { btn.disabled=false; btn.textContent='🚀 의뢰 등록'; }
    }
}

async function submitPersonalRequest() {
    if (!AppState.currentUser) { openModal('loginModal'); return; }
    var qty   = parseInt(document.getElementById('personalQty').value)||0;
    var price = parseInt(document.getElementById('personalPrice').value)||0;
    var name  = document.getElementById('personalItemName').value.trim();
    if (!name||!qty||!price) { showToast('필수 항목을 모두 입력해주세요.','error'); return; }
    var reasons=[];
    if (qty>50)              reasons.push('📦 수량 '+qty+'개는 공동구매로 진행하면 더 유리합니다.');
    if (price>0&&price<1500) reasons.push('💰 희망 단가('+price.toLocaleString()+'원)가 낮습니다.');
    if (reasons.length>0) {
        document.getElementById('coPurchaseReason').innerHTML=reasons.map(function(r){return '<p class="text-sm" style="margin-bottom:8px">'+r+'</p>';}).join('');
        openModal('coPurchasePopup'); return;
    }
    await doSubmitPersonalRequest();
}

async function doSubmitPersonalRequest() {
    var typeEl = document.querySelector('input[name="request-type"]:checked');
    var bType  = typeEl ? typeEl.value : 'bidding';
    try {
        var category = document.getElementById('personalCategory').value;
        var qty      = parseInt(document.getElementById('personalQty').value);
        var price    = parseInt(document.getElementById('personalPrice').value);
        var newReq   = await Requests.create({
            request_type: 'personal',
            title:        document.getElementById('personalItemName').value.trim(),
            category:     category, quantity: qty, target_price: price,
            bid_deadline: document.getElementById('personalDeadline').value||null,
            design_guide: document.getElementById('personalDesignGuide').value,
            detail_note:  document.getElementById('personalDetailNote').value,
            bidding_type: bType,
            direct_manufacturer_id: bType==='direct'?document.getElementById('directMfgId').value:null,
            status: 'bidding'
        });
        if (bType==='bidding') {
            try { await DummyBids.generateBids(newReq.id, category, price, qty); } catch(e){ console.error(e); }
        }
        showToast('개인 의뢰가 등록되었습니다! 🎉','success');
        showPersonalTab('myorders', null);
        loadPersonalDashboard();
    } catch(e) { showToast('오류: '+e.message,'error'); }
}

async function submitGroupRequest() {
    if (!AppState.currentUser) { openModal('loginModal'); return; }
    var title    = document.getElementById('group-title').value.trim();
    var category = document.getElementById('group-category').value;
    var totalQty = parseInt(document.getElementById('group-total-qty').value)||0;
    var minQty   = parseInt(document.getElementById('group-min-qty').value)||0;
    var price    = parseInt(document.getElementById('group-price').value)||0;
    if (!title||!category||!totalQty||!minQty||!price) { showToast('필수 항목을 모두 입력해주세요.','error'); return; }
    try {
        var gTypeEl = document.querySelector('input[name="group-type"]:checked');
        await Requests.create({
            request_type:'group', title, category,
            quantity:totalQty, min_quantity:minQty, target_price:price,
            recruit_deadline: document.getElementById('group-recruit-deadline').value||null,
            bid_deadline:     document.getElementById('group-bid-deadline').value||null,
            design_guide:     document.getElementById('group-design-guide').value,
            detail_note:      document.getElementById('group-detail-note').value,
            current_quantity:0, status:'bidding',
            bidding_type: gTypeEl ? gTypeEl.value : 'bidding'
        });
        showToast('공동제작 의뢰가 등록되었습니다! 🎉','success');
        showPersonalTab('myorders', null);
        loadPersonalDashboard();
    } catch(e) { showToast('오류: '+e.message,'error'); }
}

// ── 매칭 확정 ──────────────────────────────────────────
function confirmSelectBid(requestId, bidId, manufacturerName, unitPrice) {
    AppState.pendingMatch = {requestId, bidId, name:manufacturerName, price:unitPrice};
    var amountEl = document.getElementById('matchPayAmount');
    var detailEl = document.getElementById('matchPayDetail');
    if (amountEl) amountEl.textContent = '계산 중...';
    if (detailEl) detailEl.textContent = '';
    Requests.getById(requestId).then(function(req){
        if (req && amountEl) {
            amountEl.textContent = (req.quantity*unitPrice).toLocaleString()+'원';
            if (detailEl) detailEl.textContent = req.title+' '+req.quantity.toLocaleString()+'개 × '+unitPrice.toLocaleString()+'원 ('+manufacturerName+')';
        }
    });
    openModal('matchConfirmModal');
}

async function executeSelectBid() {
    var pm  = AppState.pendingMatch;
    if (!pm.requestId||!pm.bidId) { showToast('오류: 매칭 정보가 없습니다.','error'); return; }
    var btn = document.getElementById('matchConfirmBtn');
    if (btn) { btn.disabled=true; btn.textContent='처리 중...'; }
    try {
        await Requests.selectBid(pm.requestId, pm.bidId, pm.name, pm.price);
        closeModal('matchConfirmModal');
        AppState.pendingMatch = {};
        showToast('매칭이 확정되었습니다! 🎉','success');
        // 즉시 목록 & 대시보드 갱신
        await loadMyRequests('business');
        await loadMyRequests('personal');
        loadBizDashboard();
        loadPersonalDashboard();
        loadMatchHistoryBiz();
        loadMatchHistoryPersonal();
    } catch(e) {
        showToast('오류: '+e.message,'error');
    } finally {
        if (btn) { btn.disabled=false; btn.textContent='💳 결제 및 매칭 확정'; }
    }
}

async function cancelRequest(requestId) {
    if (!confirm('정말로 이 의뢰를 취소하시겠습니까?')) return;
    try {
        await Requests.cancel(requestId);
        showToast('의뢰가 취소되었습니다.','info');
        await loadMyRequests('business');
        await loadMyRequests('personal');
        loadBizDashboard();
        loadPersonalDashboard();
    } catch(e) { showToast('오류: '+e.message,'error'); }
}

// ── 필터 ───────────────────────────────────────────────
function filterBizStatus(status, btn) {
    if (btn) {
        document.querySelectorAll('#biz-status-pills .pill-filter').forEach(function(p){p.classList.remove('active');});
        btn.classList.add('active');
    }
    document.querySelectorAll('#biz-manage-list .request-card').forEach(function(c){
        var show = status==='all' ? true
            : status==='completed' ? (c.dataset.status==='matched'||c.dataset.status==='producing'||c.dataset.status==='shipping'||c.dataset.status==='completed')
            : c.dataset.status===status;
        c.style.display = show ? 'block' : 'none';
    });
}

function filterPersonalStatus(status, btn) {
    if (btn) {
        document.querySelectorAll('#personal-status-pills .pill-filter').forEach(function(p){p.classList.remove('active');});
        btn.classList.add('active');
    }
    document.querySelectorAll('#personal-myorders-list .request-card').forEach(function(c){
        var show = status==='all' ? true
            : status==='group'     ? c.dataset.requestType==='group'
            : status==='completed' ? (c.dataset.status==='matched'||c.dataset.status==='producing'||c.dataset.status==='shipping'||c.dataset.status==='completed')
            : c.dataset.status===status;
        c.style.display = show ? 'block' : 'none';
    });
}

// ── 스텝 ───────────────────────────────────────────────
function bizStepNext(step) {
    if (step===1) {
        var valid=true;
        [['fg-biz-title','biz-title'],['fg-biz-category','biz-category'],['fg-biz-qty','biz-qty'],['fg-biz-price','biz-price'],['fg-biz-deadline','biz-deadline']].forEach(function(p){
            var el=document.getElementById(p[1]),fg=document.getElementById(p[0]);
            if(el&&!el.value.trim()){if(fg)fg.classList.add('error');valid=false;}
            else{if(fg)fg.classList.remove('error');}
        });
        if(!valid){showToast('필수 항목을 입력해주세요.','error');return;}
    }
    document.getElementById('biz-step-'+step).style.display='none';
    document.getElementById('biz-step-'+(step+1)).style.display='block';
    AppState.bizCurrentStep=step+1; updateBizStepper();
    if(step===2) populateBizConfirm();
}
function bizStepBack(step) {
    document.getElementById('biz-step-'+step).style.display='none';
    document.getElementById('biz-step-'+(step-1)).style.display='block';
    AppState.bizCurrentStep=step-1; updateBizStepper();
}
function updateBizStepper() {
    document.querySelectorAll('#bizStepper .step').forEach(function(s,i){
        s.classList.remove('active','done');
        if(i+1<AppState.bizCurrentStep)s.classList.add('done');
        else if(i+1===AppState.bizCurrentStep)s.classList.add('active');
    });
    document.querySelectorAll('#bizStepper .step-line').forEach(function(l,i){
        l.classList.toggle('done',i+1<AppState.bizCurrentStep);
    });
}
function populateBizConfirm() {
    var qty=document.getElementById('biz-qty').value, price=document.getElementById('biz-price').value;
    setEl('confirm-title',   document.getElementById('biz-title').value);
    setEl('confirm-category',document.getElementById('biz-category').value);
    setEl('confirm-qty',     Number(qty).toLocaleString()+'개');
    setEl('confirm-price',   Number(price).toLocaleString()+'원');
    setEl('confirm-deadline',document.getElementById('biz-deadline').value);
    setEl('confirm-total',   (Number(qty)*Number(price)).toLocaleString()+'원');
    setEl('confirm-guide',   document.getElementById('biz-design-guide').value||'-');
    setEl('confirm-note',    document.getElementById('biz-detail-note').value||'-');
    var fi=document.getElementById('biz-file-input');
    setEl('confirm-files',fi&&fi.files.length>0?Array.from(fi.files).map(function(f){return f.name;}).join(', '):'없음');
}
function resetBizForm() {
    ['biz-title','biz-qty','biz-price','biz-deadline','biz-design-guide','biz-detail-note'].forEach(function(id){
        var el=document.getElementById(id);if(el)el.value='';
    });
    var cat=document.getElementById('biz-category');if(cat)cat.value='';
    document.getElementById('biz-step-3').style.display='none';
    document.getElementById('biz-step-2').style.display='none';
    document.getElementById('biz-step-1').style.display='block';
    AppState.bizCurrentStep=1; updateBizStepper();
}

// ── 기타 UI ────────────────────────────────────────────
function toggleDirectMfg(radio) {
    var f=document.getElementById('directMfgField');if(f)f.style.display=radio.value==='direct'?'block':'none';
    var rb=document.getElementById('radio-bidding'),rd=document.getElementById('radio-direct');
    if(rb)rb.style.borderColor=radio.value==='bidding'?'var(--primary)':'#E2E8F0';
    if(rd)rd.style.borderColor=radio.value==='direct'?'var(--primary)':'#E2E8F0';
}
function toggleGroupDirectMfg(radio){var f=document.getElementById('groupDirectMfgField');if(f)f.style.display=radio.value==='direct'?'block':'none';}
function showUploadedFiles(input,listId){
    var list=document.getElementById(listId);if(!list)return;
    list.innerHTML='';
    Array.from(input.files).forEach(function(f){
        var div=document.createElement('div');
        div.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg);border-radius:6px;margin-bottom:4px;font-size:13px';
        div.innerHTML='<span>📎 '+escHtml(f.name)+' ('+(f.size/1024/1024).toFixed(1)+'MB)</span><button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px">×</button>';
        list.appendChild(div);
    });
}
function setRating(n){document.querySelectorAll('#starRating span').forEach(function(s,i){s.style.opacity=i<n?'1':'0.3';});}
function setEl(id,val){var el=document.getElementById(id);if(el)el.textContent=val;}
function openModal(id){var el=document.getElementById(id);if(el)el.classList.add('show');}
function closeModal(id){var el=document.getElementById(id);if(el)el.classList.remove('show');}
function closeDropdown(){var d=document.getElementById('profileDropdown');if(d)d.classList.remove('show');}
function toggleUserMenu(e){if(e)e.stopPropagation();var d=document.getElementById('profileDropdown');if(d)d.classList.toggle('show');}
function showToast(message,type){
    var t=document.getElementById('toast');if(!t)return;
    t.textContent=message; t.className='toast '+(type||'info')+' show';
    clearTimeout(t._timer); t._timer=setTimeout(function(){t.classList.remove('show');},3500);
}
function escHtml(str){
    if(!str)return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
document.addEventListener('click',function(e){
    var d=document.getElementById('profileDropdown');
    if(d&&d.classList.contains('show')&&!e.target.closest('.nav-user'))d.classList.remove('show');
});
document.addEventListener('DOMContentLoaded', initApp);
