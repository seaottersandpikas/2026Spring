// =====================================================
// Supabase 연결 설정
// =====================================================

// ⚠️ 여기를 본인 값으로 교체하세요!
const SUPABASE_URL = 'https://gdfhomgmwthtttnkgoko.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkZmhvbWdtd3RodHR0bmtnb2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MTkyODMsImV4cCI6MjA5MjQ5NTI4M30.hrpMBj3Ev3r78imzFn7T2I4_9RFEV7NJKHNbec_cT_Y';

// =====================================================
// 위 두 줄만 수정하면 됩니다. 아래는 건드리지 마세요.
// =====================================================

(function () {
    function initSupabase() {
        try {
            if (typeof window.supabase === 'undefined') {
                console.error('❌ Supabase CDN이 로드되지 않았습니다.');
                return;
            }

            window.supabaseClient = window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_ANON_KEY
            );

            console.log('✅ Supabase 연결 완료');

        } catch (e) {
            console.error('❌ Supabase 초기화 실패:', e.message);
        }
    }

    // DOM 로드 완료 후 실행
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSupabase);
    } else {
        initSupabase();
    }
})();