var AppState = {
    currentUser: null,
    currentProfile: null,
    bizCurrentStep: 1,
    pendingMatchRequestId: null,
    pendingMatchBidId: null,
    pendingMatchPrice: null,
    pendingMatchName: null,
    priceHints: {
        '아크릴굿즈':'1,800~3,500원','의류/패브릭':'7,000~25,000원',
        '문구/스티커':'300~1,500원','패키징':'800~3,000원',
        '봉제인형':'10,000~30,000원','금속/뱃지':'2,000~5,000원','생활용품':'3,000~15,000원'
    }
};

async function initApp() {
    let attempts = 0;
    while (!window.supabaseClient && attempts < 20) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }
    if (!window.supabaseClient) {
        showToast('연결 오류. 새로고침해주세요.', 'error');
        return;
    }
    console.log('✅ App 초기화');
    Auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            AppState.currentUser = session.user;
            AppState.currentProfile = await Auth.getProfile();
            updateUILoggedIn();
        } else if (event === 'SIGNED_OUT') {
            AppState.currentUser = null;
            AppState.currentProfile = null;
            updateUILoggedOut();
        }
    });
    try {
        const user = await Auth.getUser();
        if (user) {
            AppState.currentUser = user;
            AppState.currentProfile = await Auth.getProfile();
            updateUILoggedIn();
        }
    } catch(e) {}
    loadMatchHistory();
    var bizCat = document.getElementById('biz-category');
    if (bizCat) {
        bizCat.addEventListener('change', function() {
            var hint = AppState.priceHints[this.value];
            var el = document.getElementById('biz-price-hint');
            if (el) el.textContent = hint ? '시장 평균 참고가: ' + hint : '카테고리를 선택하면 표시됩니다';
        });
    }
}

function updateUILoggedIn() {
    var p = AppState.currentProfile;
    var name = (p && p.nickname) ? p.nickname : '사용자';
    var email = (p && p.email) ? p.email : '';
    var initial = name[0].toUpperCase();
    var loginBtn = document.getElementById('loginNavBtn');
    var avatar = document.getElementById('userAvatar');
    if (loginBtn) loginBtn.style.display = 'none';
    if (avatar) { avatar.style.display = 'flex'; avatar.textContent = initial; }
    var pName = document.getElementById('profileName');
    var pEmail = document.getElementById('profileEmail');
    if (pName) pName.textContent = name;
    if (pEmail) pEmail.textContent = email;
    var bizN = document.getElementById('biz-sidebar-name');
    var perN = document.getElementById('personal-sidebar-name');
    if (bizN) bizN.textContent = name;
    if (perN) perN.textContent = name;
}

function updateUILoggedOut() {
    var loginBtn = document.getElementById('loginNavBtn');
    var avatar = document.getElementById('userAvatar');
    if (loginBtn) loginBtn.style.display = 'flex';
    if (avatar) avatar.style.display = 'none';
}

function navigateTo(page) {
    document.querySelectorAll('.page-section').forEach(function(el) { el.classList.remove('active'); });
    var target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');
    document.querySelectorAll('#mainNav button').forEach(function(b) { b.classList.remove('active'); });
    var map = { home:0, 'client-select':1, 'client-business':1, 'client-personal':1, marketplace:2 };
    var idx = map[page];
    if (idx !== undefined) {
        var btns = document.querySelectorAll('#mainNav button');
        if (btns[idx]) btns[idx].classList.add('active');
    }
    window.scrollTo(0, 0);
}

function showBizTab(tab, btn) {
    document.querySelectorAll('#page-client-business .main-content > .tab-content').forEach(function(el){ el.classList.remove('active'); });
    var el = document.getElementById('biz-' + tab);
    if (el) el.classList.add('active');
    document.querySelectorAll('#page-client-business .sidebar-menu button').forEach(function(b){ b.classList.remove('active'); });
    if (btn) { btn.classList.add('active'); }
    else {
        var map = { dashboard:0, create:1, manage:2, 'recent-match':3, payments:4 };
        var btns = document.querySelectorAll('#page-client-business .sidebar-menu button');
        if (btns[map[tab]]) btns[map[tab]].classList.add('active');
    }
    if (tab === 'manage') loadMyRequests('business');
    if (tab === 'recent-match') loadMatchHistoryBiz();
}

function showPersonalTab(tab, btn) {
    document.querySelectorAll('#page-client-personal .main-content > .tab-content').forEach(function(el){ el.classList.remove('active'); });
    var el = document.getElementById('personal-' + tab);
    if (el) el.classList.add('active');
    document.querySelectorAll('#page-client-personal .sidebar-menu button').forEach(function(b){ b.classList.remove('active'); });
    if (btn) { btn.classList.add('active'); }
    else {
        var map = { dashboard:0, individual:1, group:2, myorders:3, 'recent-match':4, payments:5 };
        var btns = document.querySelectorAll('#page-client-personal .sidebar-menu button');
        if (btns[map[tab]]) btns[map[tab]].classList.add('active');
    }
    if (tab === 'myorders') loadMyRequests('personal');
    if (tab === 'recent-match') loadMatchHistoryPersonal();
}

async function loadMyRequests(type) {
    if (!AppState.currentUser) {
        var cId = type === 'business' ? 'biz-manage-list' : 'personal-myorders-list';
        var c = document.getElementById(cId);
        if (c) c.innerHTML = '<div class="empty-state"><div class="empty-icon">🔐</div><p>로그인 후 의뢰를 확인할 수 있습니다.</p><button class="btn btn-primary" onclick="openModal(\'loginModal\')">로그인</button></div>';
        return;
    }
    var containerId = type === 'business' ? 'biz-manage-list' : 'personal-myorders-list';
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>로딩 중...</p></div>';
    try {
        var requests = await Requests.getMyRequests();
        var filtered = requests.filter(function(r) {
            return type === 'business' ? r.request_type === 'business' : (r.request_type === 'personal' || r.request_type === 'group');
        });
        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>아직 등록된 의뢰가 없습니다.</p></div>';
            return;
        }
        container.innerHTML = filtered.map(renderRequestCard).join('');
    } catch(e) {
        console.error(e);
        container.innerHTML = '<div class="empty-state"><p>오류가 발생했습니다.</p></div>';
    }
}

function renderRequestCard(req) {
    var statusMap = {
        draft:{ label:'임시저장', cls:'status-draft' },
        bidding:{ label:'입찰중 ('+(req.bids?req.bids.length:0)+'명)', cls:'status-bidding' },
        matched:{ label:'매칭완료', cls:'status-matched' },
        producing:{ label:'제작 진행중', cls:'status-producing' },
        shipping:{ label:'배송중', cls:'status-shipping' },
        completed:{ label:'배송 완료', cls:'status-completed' },
        cancelled:{ label:'취소됨', cls:'status-draft' }
    };
    var s = statusMap[req.status] || { label:req.status, cls:'' };
    var bids = req.bids ? req.bids.slice().sort(function(a,b){ return a.unit_price - b.unit_price; }) : [];
    var createdDate = new Date(req.created_at).toLocaleDateString('ko-KR');
    var bidsHtml = '';
    if (req.status === 'bidding' && bids.length > 0) {
        var rankCls = ['gold','silver','bronze'];
        bidsHtml = '<div class="divider"></div><h5 class="mb-8">📊 입찰 현황</h5>' +
            bids.slice(0,3).map(function(bid, i) {
                return '<div class="bid-item '+(i===0?'top-bid':'')+'">' +
                    '<div class="bid-info">' +
                    '<div class="bid-rank '+(rankCls[i]||'')+'">'+(i+1)+'</div>' +
                    '<div><strong>'+bid.manufacturer_name+'</strong><p class="text-xs text-muted">납기 '+(bid.delivery_days||'-')+'일</p></div>' +
                    '</div>' +
                    '<div style="display:flex;align-items:center;gap:12px">' +
                    '<div class="bid-price">'+bid.unit_price.toLocaleString()+'원</div>' +
                    '<button class="btn '+(i===0?'btn-success':'btn-outline')+' btn-sm" onclick="confirmSelectBid(\''+req.id+'\',\''+bid.id+'\',\''+bid.manufacturer_name+'\','+bid.unit_price+')">'+(i===0?'✓ 선택':'Override')+'</button>' +
                    '</div></div>';
            }).join('') +
            '<p class="text-xs text-muted mt-8">⚠️ 마감일 경과 시 최저가 입찰자에게 자동 매칭됩니다.</p>';
    }
    return '<div class="request-card" data-status="'+req.status+'" data-id="'+req.id+'">' +
        '<div class="request-card-header"><h4>'+req.title+'</h4><span class="status-badge '+s.cls+'">'+s.label+'</span></div>' +
        '<div class="request-meta">' +
        '<div class="meta-item">📦 수량: <strong>'+req.quantity.toLocaleString()+'개</strong></div>' +
        '<div class="meta-item">💰 희망 단가: <strong>'+req.target_price.toLocaleString()+'원</strong></div>' +
        '<div class="meta-item">🗓 등록: <strong>'+createdDate+'</strong></div>' +
        '</div>' + bidsHtml +
        '<div class="request-actions">' +
        (req.status==='bidding'?'<button class="btn btn-sm btn-danger" onclick="cancelRequest(\''+req.id+'\')">취소</button>':'') +
        (req.status==='completed'?'<button class="btn btn-sm btn-primary" onclick="openModal(\'writeReviewModal\')">✍️ 후기 작성</button>':'') +
        '</div></div>';
}

async function loadMatchHistory() {
    loadMatchHistoryBiz();
    loadMatchHistoryPersonal();
}

async function loadMatchHistoryBiz() {
    var tbody = document.getElementById('biz-match-tbody');
    if (!tbody) return;
    try {
        var history = await Requests.getMatchHistory('business', 20);
        if (history.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--gray)">매칭 이력이 없습니다.</td></tr>'; return; }
        tbody.innerHTML = history.map(function(h) {
            var saving = h.target_price > 0 ? Math.round((1 - h.matched_price/h.target_price)*100) : 0;
            return '<tr><td><strong>'+h.title+'</strong></td><td>'+(h.category||'-')+'</td><td>'+(h.quantity||0).toLocaleString()+'개</td><td>'+(h.target_price||0).toLocaleString()+'원</td><td class="text-success fw-bold">'+(h.matched_price||0).toLocaleString()+'원</td><td class="text-success">▼'+saving+'%</td><td>'+new Date(h.matched_at).toLocaleDateString('ko-KR')+'</td></tr>';
        }).join('');
    } catch(e) { console.error(e); }
}

async function loadMatchHistoryPersonal() {
    var tbody = document.getElementById('personal-match-tbody');
    if (!tbody) return;
    try {
        var history = await Requests.getMatchHistory(null, 20);
        var filtered = history.filter(function(h){ return h.request_type !== 'business'; });
        if (filtered.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--gray)">매칭 이력이 없습니다.</td></tr>'; return; }
        tbody.innerHTML = filtered.map(function(h) {
            var tMap = { personal:'개인', group:'공동구매' };
            var cls = h.request_type === 'group' ? 'status-recruiting' : 'status-completed';
            return '<tr><td><strong>'+h.title+'</strong></td><td>'+(h.quantity||0).toLocaleString()+'개</td><td>'+(h.target_price||0).toLocaleString()+'원</td><td class="text-success fw-bold">'+(h.matched_price||0).toLocaleString()+'원</td><td><span class="status-badge '+cls+'">'+(tMap[h.request_type]||h.request_type)+'</span></td><td>'+new Date(h.matched_at).toLocaleDateString('ko-KR')+'</td></tr>';
        }).join('');
    } catch(e) { console.error(e); }
}

async function submitBizRequest() {
    if (!AppState.currentUser) { openModal('loginModal'); return; }
    var btn = document.querySelector('#biz-step-3 .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = '등록 중...'; }
    try {
        var data = {
            request_type:'business',
            title: document.getElementById('biz-title').value.trim(),
            category: document.getElementById('biz-category').value,
            quantity: parseInt(document.getElementById('biz-qty').value),
            target_price: parseInt(document.getElementById('biz-price').value),
            bid_deadline: document.getElementById('biz-deadline').value,
            design_guide: document.getElementById('biz-design-guide').value,
            detail_note: document.getElementById('biz-detail-note').value,
            status:'bidding', bidding_type:'bidding'
        };
        await Requests.create(data);
        showToast('의뢰가 등록되었습니다! 🎉', 'success');
        resetBizForm();
        setTimeout(function(){ showBizTab('manage', null); }, 800);
    } catch(e) {
        showToast('오류: ' + e.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🚀 의뢰 등록'; }
    }
}

async function submitPersonalRequest() {
    if (!AppState.currentUser) { openModal('loginModal'); return; }
    var qty = parseInt(document.getElementById('personalQty').value) || 0;
    var price = parseInt(document.getElementById('personalPrice').value) || 0;
    var name = document.getElementById('personalItemName').value.trim();
    if (!name || !qty || !price) { showToast('필수 항목을 모두 입력해주세요.', 'error'); return; }
    var reasons = [];
    if (qty > 50) reasons.push('📦 수량 '+qty+'개는 공동구매로 진행하면 더 유리합니다.');
    if (price > 0 && price < 1500) reasons.push('💰 희망 단가('+price.toLocaleString()+'원)가 낮습니다. 공동구매를 고려해보세요.');
    if (reasons.length > 0) {
        document.getElementById('coPurchaseReason').innerHTML = reasons.map(function(r){ return '<p class="text-sm" style="margin-bottom:8px">'+r+'</p>'; }).join('');
        openModal('coPurchasePopup');
        return;
    }
    await doSubmitPersonalRequest();
}

async function doSubmitPersonalRequest() {
    var biddingTypeEl = document.querySelector('input[name="request-type"]:checked');
    var biddingType = biddingTypeEl ? biddingTypeEl.value : 'bidding';
    try {
        var data = {
            request_type:'personal',
            title: document.getElementById('personalItemName').value.trim(),
            category: document.getElementById('personalCategory').value,
            quantity: parseInt(document.getElementById('personalQty').value),
            target_price: parseInt(document.getElementById('personalPrice').value),
            bid_deadline: document.getElementById('personalDeadline').value || null,
            design_guide: document.getElementById('personalDesignGuide').value,
            detail_note: document.getElementById('personalDetailNote').value,
            bidding_type: biddingType,
            direct_manufacturer_id: biddingType === 'direct' ? document.getElementById('directMfgId').value : null,
            status:'bidding'
        };
        await Requests.create(data);
        showToast('개인 의뢰가 등록되었습니다! 🎉', 'success');
        setTimeout(function(){ showPersonalTab('myorders', null); }, 800);
    } catch(e) { showToast('오류: ' + e.message, 'error'); }
}

async function submitGroupRequest() {
    if (!AppState.currentUser) { openModal('loginModal'); return; }
    var title = document.getElementById('group-title').value.trim();
    var category = document.getElementById('group-category').value;
    var totalQty = parseInt(document.getElementById('group-total-qty').value) || 0;
    var minQty = parseInt(document.getElementById('group-min-qty').value) || 0;
    var price = parseInt(document.getElementById('group-price').value) || 0;
    if (!title || !category || !totalQty || !minQty || !price) { showToast('필수 항목을 모두 입력해주세요.', 'error'); return; }
    try {
        var groupTypeEl = document.querySelector('input[name="group-type"]:checked');
        var data = {
            request_type:'group', title:title, category:category,
            quantity:totalQty, min_quantity:minQty, target_price:price,
            recruit_deadline: document.getElementById('group-recruit-deadline').value || null,
            bid_deadline: document.getElementById('group-bid-deadline').value || null,
            design_guide: document.getElementById('group-design-guide').value,
            detail_note: document.getElementById('group-detail-note').value,
            current_quantity:0, status:'bidding',
            bidding_type: groupTypeEl ? groupTypeEl.value : 'bidding'
        };
        await Requests.create(data);
        showToast('공동제작 의뢰가 등록되었습니다! 🎉', 'success');
        setTimeout(function(){ showPersonalTab('myorders', null); }, 800);
    } catch(e) { showToast('오류: ' + e.message, 'error'); }
}

function confirmSelectBid(requestId, bidId, manufacturerName, unitPrice) {
    AppState.pendingMatchRequestId = requestId;
    AppState.pendingMatchBidId = bidId;
    AppState.pendingMatchName = manufacturerName;
    AppState.pendingMatchPrice = unitPrice;
    var amountEl = document.getElementById('matchPayAmount');
    var detailEl = document.getElementById('matchPayDetail');
    if (amountEl) amountEl.textContent = '계산 중...';
    Requests.getById(requestId).then(function(req) {
        if (req && amountEl) {
            var total = req.quantity * unitPrice;
            amountEl.textContent = total.toLocaleString() + '원';
            if (detailEl) detailEl.textContent = req.title + ' ' + req.quantity.toLocaleString() + '개 × ' + unitPrice.toLocaleString() + '원 (' + manufacturerName + ')';
        }
    });
    openModal('matchConfirmModal');
}

async function executeSelectBid() {
    var requestId = AppState.pendingMatchRequestId;
    var bidId = AppState.pendingMatchBidId;
    var name = AppState.pendingMatchName;
    var price = AppState.pendingMatchPrice;
    if (!requestId || !bidId) { showToast('오류: 매칭 정보가 없습니다.', 'error'); return; }
    var btn = document.getElementById('matchConfirmBtn');
    if (btn) { btn.disabled = true; btn.textContent = '처리 중...'; }
    try {
        await Requests.selectBid(requestId, bidId, name, price);
        closeModal('matchConfirmModal');
        showToast('매칭이 확정되었습니다! 🎉', 'success');
        loadMyRequests(AppState.currentProfile && AppState.currentProfile.user_type === 'business' ? 'business' : 'personal');
    } catch(e) {
        showToast('오류: ' + e.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '💳 결제 및 매칭 확정'; }
    }
}

async function cancelRequest(requestId) {
    if (!confirm('정말로 이 의뢰를 취소하시겠습니까?')) return;
    try {
        await Requests.cancel(requestId);
        showToast('의뢰가 취소되었습니다.', 'info');
        loadMyRequests('business');
        loadMyRequests('personal');
    } catch(e) { showToast('오류: ' + e.message, 'error'); }
}

async function handleLogin() {
    var email = document.getElementById('loginEmail').value.trim();
    var password = document.getElementById('loginPassword').value;
    if (!email || !password) { showToast('이메일과 비밀번호를 입력하세요.', 'error'); return; }
    var btn = document.getElementById('loginSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = '로그인 중...'; }
    try {
        await Auth.signIn(email, password);
        closeModal('loginModal');
        showToast('로그인되었습니다!', 'success');
    } catch(e) {
        showToast('로그인 실패: ' + e.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '로그인'; }
    }
}

async function handleSignUp() {
    var email = document.getElementById('signupEmail').value.trim();
    var password = document.getElementById('signupPassword').value;
    var nickname = document.getElementById('signupNickname').value.trim();
    var userType = document.getElementById('signupUserType').value;
    if (!email || !password || !nickname || !userType) { showToast('모든 항목을 입력해주세요.', 'error'); return; }
    if (password.length < 6) { showToast('비밀번호는 6자 이상이어야 합니다.', 'error'); return; }
    var btn = document.getElementById('signupSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = '가입 중...'; }
    try {
        await Auth.signUp(email, password, nickname, userType);
        closeModal('signupModal');
        showToast('회원가입 완료! 이메일을 확인해주세요.', 'success');
    } catch(e) {
        showToast('회원가입 실패: ' + e.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '회원가입'; }
    }
}

async function handleLogout() {
    try {
        await Auth.signOut();
        document.getElementById('profileDropdown').classList.remove('show');
        showToast('로그아웃 되었습니다.', 'success');
        navigateTo('home');
    } catch(e) { showToast('오류: ' + e.message, 'error'); }
}

function bizStepNext(step) {
    if (step === 1) {
        var valid = true;
        [['fg-biz-title','biz-title'],['fg-biz-category','biz-category'],['fg-biz-qty','biz-qty'],['fg-biz-price','biz-price'],['fg-biz-deadline','biz-deadline']].forEach(function(pair) {
            var el = document.getElementById(pair[1]);
            var fg = document.getElementById(pair[0]);
            if (el && !el.value.trim()) { if(fg) fg.classList.add('error'); valid = false; }
            else { if(fg) fg.classList.remove('error'); }
        });
        if (!valid) { showToast('필수 항목을 입력해주세요.', 'error'); return; }
    }
    document.getElementById('biz-step-'+step).style.display = 'none';
    document.getElementById('biz-step-'+(step+1)).style.display = 'block';
    AppState.bizCurrentStep = step + 1;
    updateBizStepper();
    if (step === 2) populateBizConfirm();
}

function bizStepBack(step) {
    document.getElementById('biz-step-'+step).style.display = 'none';
    document.getElementById('biz-step-'+(step-1)).style.display = 'block';
    AppState.bizCurrentStep = step - 1;
    updateBizStepper();
}

function updateBizStepper() {
    document.querySelectorAll('#bizStepper .step').forEach(function(s, i) {
        s.classList.remove('active','done');
        if (i+1 < AppState.bizCurrentStep) s.classList.add('done');
        else if (i+1 === AppState.bizCurrentStep) s.classList.add('active');
    });
    document.querySelectorAll('#bizStepper .step-line').forEach(function(l, i) {
        l.classList.toggle('done', i+1 < AppState.bizCurrentStep);
    });
}

function populateBizConfirm() {
    var title = document.getElementById('biz-title').value;
    var cat = document.getElementById('biz-category').value;
    var qty = document.getElementById('biz-qty').value;
    var price = document.getElementById('biz-price').value;
    var deadline = document.getElementById('biz-deadline').value;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-category').textContent = cat;
    document.getElementById('confirm-qty').textContent = Number(qty).toLocaleString() + '개';
    document.getElementById('confirm-price').textContent = Number(price).toLocaleString() + '원';
    document.getElementById('confirm-deadline').textContent = deadline;
    document.getElementById('confirm-total').textContent = (Number(qty)*Number(price)).toLocaleString() + '원';
    document.getElementById('confirm-guide').textContent = document.getElementById('biz-design-guide').value || '-';
    document.getElementById('confirm-note').textContent = document.getElementById('biz-detail-note').value || '-';
    var fi = document.getElementById('biz-file-input');
    document.getElementById('confirm-files').textContent = fi && fi.files.length > 0 ? Array.from(fi.files).map(function(f){return f.name;}).join(', ') : '없음';
}

function resetBizForm() {
    ['biz-title','biz-qty','biz-price','biz-deadline','biz-design-guide','biz-detail-note'].forEach(function(id) {
        var el = document.getElementById(id); if(el) el.value = '';
    });
    var cat = document.getElementById('biz-category'); if(cat) cat.value = '';
    document.getElementById('biz-step-3').style.display = 'none';
    document.getElementById('biz-step-2').style.display = 'none';
    document.getElementById('biz-step-1').style.display = 'block';
    AppState.bizCurrentStep = 1;
    updateBizStepper();
}

function toggleDirectMfg(radio) {
    var field = document.getElementById('directMfgField');
    if (field) field.style.display = radio.value === 'direct' ? 'block' : 'none';
    var rb = document.getElementById('radio-bidding');
    var rd = document.getElementById('radio-direct');
    if (rb) rb.style.borderColor = radio.value === 'bidding' ? 'var(--primary)' : '#E2E8F0';
    if (rd) rd.style.borderColor = radio.value === 'direct' ? 'var(--primary)' : '#E2E8F0';
}

function toggleGroupDirectMfg(radio) {
    var field = document.getElementById('groupDirectMfgField');
    if (field) field.style.display = radio.value === 'direct' ? 'block' : 'none';
}

function showUploadedFiles(input, listId) {
    var list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = '';
    Array.from(input.files).forEach(function(f) {
        var size = (f.size/1024/1024).toFixed(1);
        var div = document.createElement('div');
        div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg);border-radius:6px;margin-bottom:4px;font-size:13px';
        div.innerHTML = '<span>📎 '+f.name+' ('+size+'MB)</span><button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px">×</button>';
        list.appendChild(div);
    });
}

function setRating(n) {
    document.querySelectorAll('#starRating span').forEach(function(s,i){ s.style.opacity = i < n ? '1' : '0.3'; });
}

function filterBizStatus(status, btn) {
    if (btn) {
        document.querySelectorAll('#biz-status-pills .pill-filter').forEach(function(p){ p.classList.remove('active'); });
        btn.classList.add('active');
    }
    document.querySelectorAll('#biz-manage-list .request-card').forEach(function(card) {
        card.style.display = (status === 'all' || card.dataset.status === status) ? 'block' : 'none';
    });
}

function filterPillActive(btn) {
    btn.parentElement.querySelectorAll('.pill-filter').forEach(function(p){ p.classList.remove('active'); });
    btn.classList.add('active');
}

function openModal(id) { var el = document.getElementById(id); if(el) el.classList.add('show'); }
function closeModal(id) { var el = document.getElementById(id); if(el) el.classList.remove('show'); }

function showToast(message, type) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast ' + (type||'info') + ' show';
    setTimeout(function(){ toast.classList.remove('show'); }, 3000);
}

function toggleUserMenu(event) {
    if (event) event.stopPropagation();
    var d = document.getElementById('profileDropdown');
    if (d) d.classList.toggle('show');
}

document.addEventListener('click', function(e) {
    var d = document.getElementById('profileDropdown');
    if (d && d.classList.contains('show') && !e.target.closest('.nav-user')) d.classList.remove('show');
});

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.modal-overlay').forEach(function(o) {
        o.addEventListener('click', function(e) { if(e.target === this) this.classList.remove('show'); });
    });
    initApp();
});
