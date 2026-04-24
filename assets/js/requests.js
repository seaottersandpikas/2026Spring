// =====================================================
// 의뢰(Request) 관련 데이터베이스 함수들
// =====================================================

const Requests = {

  // ── 의뢰 생성 ──────────────────────────────────────
  async create(requestData) {
    const user = await Auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabaseClient
      .from('requests')
      .insert([{ ...requestData, user_id: user.id }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ── 내 의뢰 목록 조회 ───────────────────────────────
  async getMyRequests(statusFilter = null) {
    const user = await Auth.getUser();
    if (!user) return [];

    let query = supabaseClient
      .from('requests')
      .select(`
        *,
        bids (
          id, manufacturer_name, unit_price, delivery_days, status, created_at, note
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (statusFilter) query = query.eq('status', statusFilter);

    const { data, error } = await query;
    if (error) { console.error('의뢰 조회 오류:', error); return []; }
    return data || [];
  },

  // ── 특정 의뢰 상세 조회 ─────────────────────────────
  async getById(requestId) {
    const { data, error } = await supabaseClient
      .from('requests')
      .select(`
        *,
        bids (
          id, manufacturer_name, unit_price, delivery_days, 
          status, created_at, note, manufacturer_id
        ),
        request_files (id, file_name, file_url),
        profiles (nickname, company_name)
      `)
      .eq('id', requestId)
      .single();

    if (error) { console.error('의뢰 상세 조회 오류:', error); return null; }
    return data;
  },

  // ── 의뢰 수정 ──────────────────────────────────────
  async update(requestId, updateData) {
    const { data, error } = await supabaseClient
      .from('requests')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ── 의뢰 취소 ──────────────────────────────────────
  async cancel(requestId) {
    return this.update(requestId, { status: 'cancelled' });
  },

  // ── 입찰 선택 (매칭 확정) ───────────────────────────
  async selectBid(requestId, bidId, manufacturerName, unitPrice) {
    // 1. 해당 입찰을 'selected'로 변경
    const { error: bidError } = await supabaseClient
      .from('bids')
      .update({ status: 'selected' })
      .eq('id', bidId);
    if (bidError) throw bidError;

    // 2. 나머지 입찰들은 'rejected'로 변경
    const { error: rejectError } = await supabaseClient
      .from('bids')
      .update({ status: 'rejected' })
      .eq('request_id', requestId)
      .neq('id', bidId);
    if (rejectError) throw rejectError;

    // 3. 의뢰 상태를 'matched'로 변경
    const req = await this.update(requestId, { status: 'matched' });

    // 4. 매칭 이력 저장
    await supabaseClient.from('match_history').insert([{
      request_id: requestId,
      bid_id: bidId,
      category: req.category,
      title: req.title,
      quantity: req.quantity,
      target_price: req.target_price,
      matched_price: unitPrice,
      request_type: req.request_type
    }]);

    return req;
  },

  // ── 최근 매칭 이력 조회 ─────────────────────────────
  async getMatchHistory(requestType = null, limit = 20) {
    let query = supabaseClient
      .from('match_history')
      .select('*')
      .order('matched_at', { ascending: false })
      .limit(limit);

    if (requestType) query = query.eq('request_type', requestType);

    const { data, error } = await query;
    if (error) { console.error('매칭 이력 조회 오류:', error); return []; }
    return data || [];
  },

  // ── 공동구매 참여 신청 ──────────────────────────────
  async joinGroupPurchase(requestId, quantity) {
    const user = await Auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    // 참여 테이블에 추가
    const { data, error } = await supabaseClient
      .from('group_participants')
      .insert([{ request_id: requestId, user_id: user.id, quantity }])
      .select()
      .single();
    if (error) throw error;

    // 현재 수량 업데이트 (기존 수량 + 신청 수량)
    const { data: req } = await supabaseClient
      .from('requests')
      .select('current_quantity')
      .eq('id', requestId)
      .single();

    const newQty = (req?.current_quantity || 0) + quantity;
    await supabaseClient
      .from('requests')
      .update({ current_quantity: newQty })
      .eq('id', requestId);

    return data;
  },

  // ── 파일 업로드 ────────────────────────────────────
  async uploadFile(requestId, file) {
    const user = await Auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const fileName = `${user.id}/${requestId}/${Date.now()}_${file.name}`;

    // Storage에 업로드
    const { data: uploadData, error: uploadError } = await supabaseClient
      .storage
      .from('request-files')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    // 공개 URL 가져오기
    const { data: { publicUrl } } = supabaseClient
      .storage
      .from('request-files')
      .getPublicUrl(fileName);

    // 파일 정보 저장
    const { data, error } = await supabaseClient
      .from('request_files')
      .insert([{
        request_id: requestId,
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

window.Requests = Requests;