// =====================================================
// 인증(로그인/회원가입) 관련 함수들
// =====================================================

const Auth = {

  // 현재 로그인된 사용자 가져오기
  async getUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
  },

  // 현재 사용자 프로필 가져오기
  async getProfile() {
    const user = await this.getUser();
    if (!user) return null;
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) { console.error('프로필 조회 오류:', error); return null; }
    return data;
  },

  // 이메일/비밀번호로 회원가입
  async signUp(email, password, nickname, userType) {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { nickname, user_type: userType } }
    });
    if (error) throw error;

    // 프로필 업데이트
    if (data.user) {
      await supabaseClient.from('profiles').upsert({
        id: data.user.id,
        email,
        nickname,
        user_type: userType
      });
    }
    return data;
  },

  // 로그인
  async signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  // 로그아웃
  async signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  },

  // 인증 상태 변경 감지
  onAuthStateChange(callback) {
    return supabaseClient.auth.onAuthStateChange(callback);
  }
};

window.Auth = Auth;
