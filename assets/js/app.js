// =====================================================
// 메인 앱 로직 (UI 조작, 이벤트 처리)
// =====================================================

// ── 전역 상태 ────────────────────────────────────────
const AppState = {
  currentUser: null,
  currentProfile: null,
  bizCurrentStep: 1,
  priceHints: {
    '아크릴굿즈': '₩1,800~₩3,500',
    '의류/패브릭': '₩7,000~₩25,000',
    '문구/스티커': '₩300~₩1,500',
    '패키징': '₩800~₩3,000',
    '봉제인형': '₩10,000~₩30,000',
    '금속/뱃지': '₩2,000~₩5,000',
    '생활용품': '₩3,000~₩15,000'
  }
};

// ── 앱 초기화 ────────────────────────────────────────
async function initApp() {

    // supabaseClient가 준비될 때까지 잠깐 기다림
    let attempts = 0;
    while (!window.supabaseClient && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    if (!window.supabaseClient) {
        console.error('❌ Supabase 초기화 실패 - 페이지를 새로고침해주세요.');
        showToast('연결 오류가 발생했습니다. 페이지를 새로고침해주세요.', 'error');
        return;
    }

    console.log('✅ App 초기화 시작');

    // 인증 상태 감지
    Auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            AppState.currentUser = session.user;
            AppState.currentProfile = await Auth.getProfile();
            updateUIForLoggedInUser();
        } else if (event === 'SIGNED_OUT') {
            AppState.currentUser = null;
            AppState.currentProfile = null;
            updateUIForLoggedOutUser();
        }
    });

    // 현재 사용자 확인
    try {
        const user = await Auth.getUser();
        if (user) {
            AppState.currentUser = user;
            AppState.currentProfile = await Auth.getProfile();
            updateUIForLoggedInUser();
        }
    } catch (e) {
        console.log('로그인 상태 아님');
    }

    // 최근 매칭 이력 로드
    loadMatchHistory();

    // 카테고리 변경 이벤트
    const bizCategoryEl = document.getElementById('biz-category');
    if (bizCategoryEl) {
        bizCategoryEl.addEventListener('change', function () {
            const hint = AppState.priceHints[this.value];
            const hintEl = document.getElementById('biz-price-hint');
            if (hintEl) hintEl.textContent = hint
                ? '시장 평균 참고가: ' + hint
                : '카테고리를 선택하면 표시됩니다';
        });
    }
}

// ── UI 업데이트 함수들 ───────────────────────────────

function updateUIForLoggedInUser() {
  const profile = AppState.currentProfile;
  if (!profile) return;

  // 아바타 이니셜 변경
  const avatar = document.querySelector('.user-avatar');
  if (avatar) avatar.textContent = (profile.nickname || profile.email || 'U')[0].toUpperCase();

  // 프로필 정보 업데이트
  const profileName = document.querySelector('.profile-header-info strong');
  const profileEmail = document.querySelector('.profile-header-info .text-xs');
  if (profileName) profileName.textContent = profile.nickname || '사용자';
  if (profileEmail) profileEmail.textContent = profile.email || '';

  // 사이드바 이름 업데이트
  const bizName = document.querySelector('#page-client-business .sidebar h4');
  const personalName = document.querySelector('#page-client-personal .sidebar h4');
  if (bizName) bizName.textContent = profile.company_name || profile.nickname || '사용자';
  if (personalName) personalName.textContent = profile.nickname || '사용자';

  // 로그인 버튼 숨기기, 아바타 보이기
  const loginBtn = document.getElementById('loginNavBtn');
  if (loginBtn) loginBtn.style.display = 'none';
}

function updateUIForLoggedOutUser() {
  const loginBtn = document.getElementById('loginNavBtn');
  if (loginBtn) loginBtn.style.display = 'flex';
}

// ── 네비게이션 ───────────────────────────────────────
function navigateTo(page) {
  document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  document.querySelectorAll('#mainNav button').forEach(btn => btn.classList.remove('active'));
  const navMap = {
    'home': 0,
    'client-select': 1, 'client-business': 1, 'client-personal': 1,
    'marketplace': 2
  };
  const idx = navMap[page];
  if (idx !== undefined) {
    const btns = document.querySelectorAll('#mainNav button');
    if (btns[idx]) btns[idx].classList.add('active');
  }
  window.scrollTo(0, 0);
}

// ── 탭 관리 ──────────────────────────────────────────
function showBizTab(tab, btn) {
  document.querySelectorAll('#page-client-business .main-content > .tab-content')
    .forEach(el => el.classList.remove('active'));
  const tabEl = document.getElementById('biz-' + tab);
  if (tabEl) tabEl.classList.add('active');

  document.querySelectorAll('#page-client-business .sidebar-menu button')
    .forEach(b => b.classList.remove('active'));

  if (btn) {
    btn.classList.add('active');
  } else {
    const tabMap = { 'dashboard': 0, 'create': 1, 'manage': 2, 'recent-match': 3, 'payments': 4 };
    const buttons = document.querySelectorAll('#page-client-business .sidebar-menu button');
    if (buttons[tabMap[tab]]) buttons[tabMap[tab]].classList.add('active');
  }

  // 탭 전환 시 데이터 로드
  if (tab === 'manage') loadMyRequests('business');
  if (tab === 'recent-match') loadMatchHistory('business');
}

function showPersonalTab(tab, btn) {
  document.querySelectorAll('#page-client-personal .main-content > .tab-content')
    .forEach(el => el.classList.remove('active'));
  const tabEl = document.getElementById('personal-' + tab);
  if (tabEl) tabEl.classList.add('active');

  document.querySelectorAll('#page-client-personal .sidebar-menu button')
    .forEach(b => b.classList.remove('active'));

  if (btn) {
    btn.classList.add('active');
  } else {
    const tabMap = {
      'dashboard': 0, 'individual': 1, 'group': 2,
      'myorders': 3, 'recent-match': 4, 'payments': 5
    };
    const buttons = document.querySelectorAll('#page-client-personal .sidebar-menu button');
    if (buttons[tabMap[tab]]) buttons[tabMap[tab]].classList.add('active');
  }

  if (tab === 'myorders') loadMyRequests('personal');
  if (tab === 'recent-match') loadMatchHistory('personal');
}

// ── 데이터 로딩 함수들 ───────────────────────────────

// 내 의뢰 목록 로드 및 렌더링
async function loadMyRequests(type) {
  if (!AppState.currentUser) return;

  const containerId = type === 'business' ? 'biz-manage-list' : 'personal-myorders-list';
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>로딩 중...</p></div>';

  try {
    const requests = await Requests.getMyRequests();
    const filtered = requests.filter(r =>
      type === 'business'
        ? r.request_type === 'business'
        : r.request_type === 'personal' || r.request_type === 'group'
    );

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>아직 등록된 의뢰가 없습니다.</p>
          <button class="btn btn-primary" onclick="${type === 'business' ? "showBizTab('create',null)" : "showPersonalTab('individual',null)"}">
            첫 의뢰 만들기
          </button>
        </div>`;
      return;
    }

    container.innerHTML = filtered.map(req => renderRequestCard(req)).join('');
  } catch (err) {
    console.error('의뢰 로드 오류:', err);
    container.innerHTML = '<div class="empty-state"><p>데이터를 불러오는 중 오류가 발생했습니다.</p></div>';
  }
}

// 의뢰 카드 HTML 렌더링
function renderRequestCard(req) {
  const statusMap = {
    draft: { label: '임시저장', cls: 'status-draft' },
    bidding: { label: `입찰중 (${req.bids?.length || 0}명)`, cls: 'status-bidding' },
    matched: { label: '매칭완료', cls: 'status-matched' },
    producing: { label: '제작 진행중', cls: 'status-producing' },
    shipping: { label: '배송중', cls: 'status-shipping' },
    completed: { label: '배송 완료', cls: 'status-completed' },
    cancelled: { label: '취소됨', cls: 'status-draft' }
  };
  const { label, cls } = statusMap[req.status] || { label: req.status, cls: '' };

  const bids = req.bids || [];
  const sortedBids = [...bids].sort((a, b) => a.unit_price - b.unit_price);

  const createdDate = new Date(req.created_at).toLocaleDateString('ko-KR');
  const deadlineText = req.bid_deadline
    ? `${req.bid_deadline} (D-${Math.ceil((new Date(req.bid_deadline) - new Date()) / 86400000)})`
    : '마감일 미설정';

  let bidsHtml = '';
  if (req.status === 'bidding' && sortedBids.length > 0) {
    const rankLabels = ['gold', 'silver', 'bronze'];
    bidsHtml = `
      <div class="divider"></div>
      <h5 class="mb-8">📊 입찰 현황 <span class="text-xs text-muted">(클릭하여 상세 견적 확인)</span></h5>
      ${sortedBids.slice(0, 3).map((bid, i) => `
        <div class="bid-item ${i === 0 ? 'top-bid' : ''}"
             onclick="openBidDetail('${bid.id}','${req.id}')">
          <div class="bid-info">
            <div class="bid-rank ${rankLabels[i] || ''}">${i + 1}</div>
            <div><strong>${bid.manufacturer_name}</strong>
              <p class="text-xs text-muted">납기 ${bid.delivery_days || '-'}일</p>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <div>
              <div class="bid-price">₩${bid.unit_price.toLocaleString()}</div>
            </div>
            <button class="btn ${i === 0 ? 'btn-success' : 'btn-outline'} btn-sm"
              onclick="event.stopPropagation();confirmSelectBid('${req.id}','${bid.id}','${bid.manufacturer_name}',${bid.unit_price})">
              ${i === 0 ? '✓ 선택' : 'Override'}
            </button>
          </div>
        </div>
      `).join('')}
      <p class="text-xs text-muted mt-8">⚠️ 마감일 경과 시 최저가 입찰자에게 자동 매칭됩니다.</p>
    `;
  }

  return `
    <div class="request-card" data-status="${req.status}" data-id="${req.id}">
      <div class="request-card-header">
        <h4>${req.title}</h4>
        <span class="status-badge ${cls}">${label}</span>
      </div>
      <div class="request-meta">
        <div class="meta-item">📦 수량: <strong>${req.quantity.toLocaleString()}개</strong></div>
        <div class="meta-item">💰 희망 단가: <strong>₩${req.target_price.toLocaleString()}</strong></div>
        <div class="meta-item">📅 마감: <strong>${deadlineText}</strong></div>
        <div class="meta-item">🗓 등록: <strong>${createdDate}</strong></div>
      </div>
      ${bidsHtml}
      <div class="request-actions">
        <button class="btn btn-sm btn-secondary" onclick="openRequestDetail('${req.id}')">상세 보기</button>
        ${req.status === 'bidding' ? `<button class="btn btn-sm btn-danger" onclick="cancelRequest('${req.id}')">취소</button>` : ''}
        ${req.status === 'completed' ? `<button class="btn btn-sm btn-primary" onclick="openModal('writeReviewModal')">✍️ 후기 작성</button>` : ''}
      </div>
    </div>`;
}

// 최근 매칭 이력 로드
async function loadMatchHistory(type = null) {
  const bizContainer = document.querySelector('#biz-recent-match tbody');
  const personalContainer = document.querySelector('#personal-recent-match tbody');

  try {
    const history = await Requests.getMatchHistory(type, 20);

    if (bizContainer && (!type || type === 'business')) {
      const bizHistory = history.filter(h => h.request_type === 'business' || !type);
      bizContainer.innerHTML = bizHistory.length > 0
        ? bizHistory.map(h => `
          <tr>
            <td><strong>${h.title}</strong></td>
            <td>${h.category}</td>
            <td>${h.quantity?.toLocaleString()}개</td>
            <td>₩${h.target_price?.toLocaleString()}</td>
            <td class="text-success fw-bold">₩${h.matched_price?.toLocaleString()}</td>
            <td class="text-success">▼${Math.round((1 - h.matched_price / h.target_price) * 100)}%</td>
            <td>${new Date(h.matched_at).toLocaleDateString('ko-KR')}</td>
          </tr>`).join('')
        : '<tr><td colspan="7" style="text-align:center;color:var(--gray)">매칭 이력이 없습니다.</td></tr>';
    }

    if (personalContainer && (!type || type === 'personal' || type === 'group')) {
      const personalHistory = history.filter(h => h.request_type !== 'business' || !type);
      personalContainer.innerHTML = personalHistory.length > 0
        ? personalHistory.map(h => {
          const typeMap = { personal: '개인', group: '공동구매', business: '사업자' };
          const cls = h.request_type === 'group' ? 'status-recruiting' : 'status-completed';
          return `
            <tr>
              <td><strong>${h.title}</strong></td>
              <td>${h.quantity?.toLocaleString()}개</td>
              <td>₩${h.target_price?.toLocaleString()}</td>
              <td class="text-success fw-bold">₩${h.matched_price?.toLocaleString()}</td>
              <td><span class="status-badge ${cls}">${typeMap[h.request_type] || h.request_type}</span></td>
              <td>${new Date(h.matched_at).toLocaleDateString('ko-KR')}</td>
            </tr>`;
        }).join('')
        : '<tr><td colspan="6" style="text-align:center;color:var(--gray)">매칭 이력이 없습니다.</td></tr>';
    }
  } catch (err) {
    console.error('매칭 이력 로드 오류:', err);
  }
}

// ── 의뢰 제출 함수들 ─────────────────────────────────

// 사업자 의뢰 제출
async function submitBizRequest() {
  if (!AppState.currentUser) {
    openModal('loginModal');
    showToast('로그인이 필요합니다.', 'error');
    return;
  }

  const submitBtn = document.querySelector('#biz-step-3 .btn-primary');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '등록 중...'; }

  try {
    const requestData = {
      request_type: 'business',
      title: document.getElementById('biz-title').value.trim(),
      category: document.getElementById('biz-category').value,
      quantity: parseInt(document.getElementById('biz-qty').value),
      target_price: parseInt(document.getElementById('biz-price').value),
      bid_deadline: document.getElementById('biz-deadline').value,
      design_guide: document.getElementById('biz-design-guide').value,
      detail_note: document.getElementById('biz-detail-note').value,
      status: 'bidding',
      bidding_type: 'bidding'
    };

    const newRequest = await Requests.create(requestData);

    // 파일 업로드 (있을 경우)
    const fileInput = document.getElementById('biz-file-input');
    if (fileInput?.files.length > 0) {
      for (const file of fileInput.files) {
        await Requests.uploadFile(newRequest.id, file).catch(e => console.warn('파일 업로드 실패:', e));
      }
    }

    showToast('의뢰가 성공적으로 등록되었습니다! 🎉', 'success');

    // 폼 초기화
    resetBizForm();

    // 의뢰 관리 탭으로 이동
    setTimeout(() => showBizTab('manage', null), 800);

  } catch (err) {
    console.error('의뢰 등록 오류:', err);
    showToast('오류가 발생했습니다: ' + err.message, 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '🚀 의뢰 등록'; }
  }
}

// 개인 의뢰 제출
async function submitPersonalRequest() {
  if (!AppState.currentUser) {
    openModal('loginModal');
    showToast('로그인이 필요합니다.', 'error');
    return;
  }

  const qty = parseInt(document.getElementById('personalQty')?.value) || 0;
  const price = parseInt(document.getElementById('personalPrice')?.value) || 0;
  const itemName = document.getElementById('personalItemName')?.value?.trim();

  if (!itemName || !qty || !price) {
    showToast('필수 항목을 모두 입력해주세요.', 'error');
    return;
  }

  // 공동구매 추천 팝업
  let reasons = [];
  if (qty > 50) reasons.push(`📦 수량 ${qty}개는 공동구매로 진행하면 더 유리한 단가를 받을 수 있습니다.`);
  if (price > 0 && price < 1500) reasons.push(`💰 희망 단가(₩${price.toLocaleString()})가 낮습니다. 공동구매로 물량을 모아보세요.`);

  if (reasons.length > 0) {
    document.getElementById('coPurchaseReason').innerHTML =
      reasons.map(r => `<p class="text-sm" style="margin-bottom:8px">${r}</p>`).join('');
    openModal('coPurchasePopup');
    return;
  }

  await doSubmitPersonalRequest();
}

async function doSubmitPersonalRequest() {
  const requestTypeEl = document.querySelector('input[name="request-type"]:checked');
  const biddingType = requestTypeEl?.value || 'bidding';
  const directId = document.querySelector('#directMfgField input')?.value;

  try {
    const requestData = {
      request_type: 'personal',
      title: document.getElementById('personalItemName').value.trim(),
      category: document.getElementById('personalCategory')?.value,
      quantity: parseInt(document.getElementById('personalQty').value),
      target_price: parseInt(document.getElementById('personalPrice').value),
      bidding_type: biddingType,
      direct_manufacturer_id: biddingType === 'direct' ? directId : null,
      status: 'bidding'
    };

    await Requests.create(requestData);
    showToast('개인 의뢰가 등록되었습니다! 🎉', 'success');
    setTimeout(() => showPersonalTab('myorders', null), 800);
  } catch (err) {
    console.error('개인 의뢰 등록 오류:', err);
    showToast('오류: ' + err.message, 'error');
  }
}

// 공동구매 의뢰 제출
async function submitGroupRequest() {
  if (!AppState.currentUser) {
    openModal('loginModal');
    showToast('로그인이 필요합니다.', 'error');
    return;
  }

  try {
    const groupForm = document.getElementById('group-form');
    const inputs = groupForm ? groupForm.querySelectorAll('input, select, textarea') : [];
    const formData = {};
    inputs.forEach(el => { if (el.id) formData[el.id] = el.value; });

    const requestData = {
      request_type: 'group',
      title: document.getElementById('group-title')?.value?.trim(),
      category: document.getElementById('group-category')?.value,
      quantity: parseInt(document.getElementById('group-total-qty')?.value) || 0,
      min_quantity: parseInt(document.getElementById('group-min-qty')?.value) || 0,
      target_price: parseInt(document.getElementById('group-price')?.value) || 0,
      recruit_deadline: document.getElementById('group-recruit-deadline')?.value,
      bid_deadline: document.getElementById('group-bid-deadline')?.value,
      design_guide: document.getElementById('group-design-guide')?.value,
      detail_note: document.getElementById('group-detail-note')?.value,
      current_quantity: 0,
      status: 'bidding',
      bidding_type: document.querySelector('input[name="group-type"]:checked')?.value || 'bidding'
    };

    if (!requestData.title || !requestData.category || !requestData.quantity) {
      showToast('필수 항목을 모두 입력해주세요.', 'error');
      return;
    }

    await Requests.create(requestData);
    showToast('공동제작 의뢰가 마켓플레이스에 등록되었습니다! 🎉', 'success');
    setTimeout(() => showPersonalTab('myorders', null), 800);
  } catch (err) {
    console.error('공동구매 등록 오류:', err);
    showToast('오류: ' + err.message, 'error');
  }
}

// ── 매칭 확정 ────────────────────────────────────────
function confirmSelectBid(requestId, bidId, manufacturerName, unitPrice) {
  // 모달 내용 업데이트
  const modal = document.getElementById('matchConfirmModal');
  if (modal) {
    modal.querySelector('.pay-amount').textContent = '확인 중...';
    modal.dataset.requestId = requestId;
    modal.dataset.bidId = bidId;
    modal.dataset.manufacturerName = manufacturerName;
    modal.dataset.unitPrice = unitPrice;

    // 수량 조회 후 총액 계산
    Requests.getById(requestId).then(req => {
      if (req) {
        const total = req.quantity * unitPrice;
        modal.querySelector('.pay-amount').textContent = `₩${total.toLocaleString()}`;
        const detail = modal.querySelector('.pay-detail');
        if (detail) detail.textContent = `${req.title} ${req.quantity.toLocaleString()}개 × ₩${unitPrice.toLocaleString()} (${manufacturerName})`;
      }
    });
  }
  openModal('matchConfirmModal');
}

async function executeSelectBid() {
  const modal = document.getElementById('matchConfirmModal');
  const requestId = modal?.dataset.requestId;
  const bidId = modal?.dataset.bidId;
  const manufacturerName = modal?.dataset.manufacturerName;
  const unitPrice = parseInt(modal?.dataset.unitPrice);

  if (!requestId || !bidId) { showToast('오류: 매칭 정보가 없습니다.', 'error'); return; }

  const confirmBtn = modal.querySelector('.btn-success');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '처리 중...'; }

  try {
    await Requests.selectBid(requestId, bidId, manufacturerName, unitPrice);
    closeModal('matchConfirmModal');
    showToast('매칭이 확정되었습니다! 🎉', 'success');
    loadMyRequests(AppState.currentProfile?.user_type === 'business' ? 'business' : 'personal');
  } catch (err) {
    console.error('매칭 확정 오류:', err);
    showToast('오류: ' + err.message, 'error');
  } finally {
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '💳 결제 및 매칭 확정'; }
  }
}

// 의뢰 취소
async function cancelRequest(requestId) {
  if (!confirm('정말로 이 의뢰를 취소하시겠습니까?')) return;
  try {
    await Requests.cancel(requestId);
    showToast('의뢰가 취소되었습니다.', 'info');
    loadMyRequests(AppState.currentProfile?.user_type === 'business' ? 'business' : 'personal');
  } catch (err) {
    showToast('오류: ' + err.message, 'error');
  }
}

// ── 로그인 / 회원가입 ────────────────────────────────

async function handleLogin() {
  const email = document.getElementById('loginEmail')?.value?.trim();
  const password = document.getElementById('loginPassword')?.value;
  if (!email || !password) { showToast('이메일과 비밀번호를 입력하세요.', 'error'); return; }

  const btn = document.getElementById('loginSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = '로그인 중...'; }

  try {
    await Auth.signIn(email, password);
    closeModal('loginModal');
    showToast('로그인되었습니다!', 'success');
  } catch (err) {
    showToast('로그인 실패: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '로그인'; }
  }
}

async function handleSignUp() {
  const email = document.getElementById('signupEmail')?.value?.trim();
  const password = document.getElementById('signupPassword')?.value;
  const nickname = document.getElementById('signupNickname')?.value?.trim();
  const userType = document.getElementById('signupUserType')?.value;

  if (!email || !password || !nickname || !userType) {
    showToast('모든 항목을 입력해주세요.', 'error');
    return;
  }
  if (password.length < 6) {
    showToast('비밀번호는 6자 이상이어야 합니다.', 'error');
    return;
  }

  const btn = document.getElementById('signupSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = '가입 중...'; }

  try {
    await Auth.signUp(email, password, nickname, userType);
    closeModal('signupModal');
    showToast('회원가입 완료! 이메일을 확인해주세요.', 'success');
  } catch (err) {
    showToast('회원가입 실패: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '회원가입'; }
  }
}

async function handleLogout() {
  try {
    await Auth.signOut();
    document.getElementById('profileDropdown')?.classList.remove('show');
    showToast('로그아웃 되었습니다.', 'success');
    navigateTo('home');
  } catch (err) {
    showToast('오류: ' + err.message, 'error');
  }
}

// ── Biz 스텝 관리 ────────────────────────────────────
function bizStepNext(step) {
  if (step === 1) {
    let valid = true;
    const fields = [
      ['fg-biz-title', 'biz-title'],
      ['fg-biz-category', 'biz-category'],
      ['fg-biz-qty', 'biz-qty'],
      ['fg-biz-price', 'biz-price'],
      ['fg-biz-deadline', 'biz-deadline']
    ];
    fields.forEach(([fg, id]) => {
      const el = document.getElementById(id);
      const fgEl = document.getElementById(fg);
      if (el && !el.value.trim()) {
        fgEl?.classList.add('error'); valid = false;
      } else {
        fgEl?.classList.remove('error');
      }
    });
    if (!valid) { showToast('필수 항목을 입력해주세요.', 'error'); return; }
  }

  document.getElementById(`biz-step-${step}`).style.display = 'none';
  document.getElementById(`biz-step-${step + 1}`).style.display = 'block';
  AppState.bizCurrentStep = step + 1;
  updateBizStepper();

  if (step === 2) populateBizConfirm();
}

function bizStepBack(step) {
  document.getElementById(`biz-step-${step}`).style.display = 'none';
  document.getElementById(`biz-step-${step - 1}`).style.display = 'block';
  AppState.bizCurrentStep = step - 1;
  updateBizStepper();
}

function updateBizStepper() {
  document.querySelectorAll('#bizStepper .step').forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i + 1 < AppState.bizCurrentStep) s.classList.add('done');
    else if (i + 1 === AppState.bizCurrentStep) s.classList.add('active');
  });
  document.querySelectorAll('#bizStepper .step-line').forEach((l, i) => {
    l.classList.toggle('done', i + 1 < AppState.bizCurrentStep);
  });
}

function populateBizConfirm() {
  const title = document.getElementById('biz-title')?.value;
  const cat = document.getElementById('biz-category')?.value;
  const qty = document.getElementById('biz-qty')?.value;
  const price = document.getElementById('biz-price')?.value;
  const deadline = document.getElementById('biz-deadline')?.value;
  const guide = document.getElementById('biz-design-guide')?.value || '-';
  const note = document.getElementById('biz-detail-note')?.value || '-';

  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-category').textContent = cat;
  document.getElementById('confirm-qty').textContent = Number(qty).toLocaleString() + '개';
  document.getElementById('confirm-price').textContent = '₩' + Number(price).toLocaleString();
  document.getElementById('confirm-deadline').textContent = deadline;
  document.getElementById('confirm-total').textContent = '₩' + (Number(qty) * Number(price)).toLocaleString();
  document.getElementById('confirm-guide').textContent = guide;
  document.getElementById('confirm-note').textContent = note;

  const fileInput = document.getElementById('biz-file-input');
  document.getElementById('confirm-files').textContent =
    fileInput?.files.length > 0
      ? Array.from(fileInput.files).map(f => f.name).join(', ')
      : '없음';
}

function resetBizForm() {
  ['biz-title', 'biz-qty', 'biz-price', 'biz-deadline', 'biz-design-guide', 'biz-detail-note']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const cat = document.getElementById('biz-category');
  if (cat) cat.value = '';

  document.getElementById('biz-step-3').style.display = 'none';
  document.getElementById('biz-step-2').style.display = 'none';
  document.getElementById('biz-step-1').style.display = 'block';
  AppState.bizCurrentStep = 1;
  updateBizStepper();
}

// ── 기타 UI 함수들 ───────────────────────────────────

function toggleDirectMfg(radio) {
  document.getElementById('directMfgField').style.display = radio.value === 'direct' ? 'block' : 'none';
  document.getElementById('radio-bidding').style.borderColor = radio.value === 'bidding' ? 'var(--primary)' : '#E2E8F0';
  document.getElementById('radio-direct').style.borderColor = radio.value === 'direct' ? 'var(--primary)' : '#E2E8F0';
}

function toggleGroupDirectMfg(radio) {
  const field = document.getElementById('groupDirectMfgField');
  if (field) field.style.display = radio.value === 'direct' ? 'block' : 'none';
}

function showUploadedFiles(input, listId) {
  const list = document.getElementById(listId);
  if (!list) return;
  list.innerHTML = '';
  Array.from(input.files).forEach(f => {
    const size = (f.size / 1024 / 1024).toFixed(1);
    list.innerHTML += `
      <div style="display:flex;justify-content:space-between;align-items:center;
           padding:8px 12px;background:var(--bg);border-radius:6px;
           margin-bottom:4px;font-size:13px">
        <span>📎 ${f.name} (${size}MB)</span>
        <button onclick="this.parentElement.remove()"
          style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px">×</button>
      </div>`;
  });
}

function setRating(n) {
  document.querySelectorAll('#starRating span').forEach((s, i) => {
    s.style.opacity = i < n ? '1' : '0.3';
  });
}

function openModal(id) { document.getElementById(id)?.classList.add('show'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('show'); }

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function toggleUserMenu(event) {
  if (event) event.stopPropagation();
  document.getElementById('profileDropdown')?.classList.toggle('show');
}

function filterBizStatus(status, btn) {
  if (btn) {
    document.querySelectorAll('#biz-status-pills .pill-filter').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
  }
  document.querySelectorAll('#biz-manage .request-card').forEach(card => {
    card.style.display = (status === 'all' || card.dataset.status === status) ? 'block' : 'none';
  });
}

function filterPillActive(btn) {
  btn.parentElement.querySelectorAll('.pill-filter').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
}

function openRequestDetail(requestId) {
  showToast('의뢰 상세 조회 중...', 'info');
  Requests.getById(requestId).then(req => {
    if (req) openModal('orderDetailModal');
  });
}

function openBidDetail(bidId, requestId) {
  openModal('clientEstimateModal');
}

// 클릭 외부 시 드롭다운 닫기
document.addEventListener('click', function(e) {
  const d = document.getElementById('profileDropdown');
  if (d?.classList.contains('show') && !e.target.closest('.nav-user')) {
    d.classList.remove('show');
  }
});

// 모달 오버레이 클릭 시 닫기
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('show');
  });
});

// 앱 시작
document.addEventListener('DOMContentLoaded', initApp);