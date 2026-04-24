// =====================================================
// Supabase 연결 설정
// ⚠️ 아래 두 값을 본인의 Supabase 프로젝트 값으로 교체하세요!
// =====================================================

const SUPABASE_URL = 'postgresql://postgres:Ehclfkddjsslfkd<3@db.gdfhomgmwthtttnkgoko.supabase.co:5432/postgres'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkZmhvbWdtd3RodHR0bmtnb2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MTkyODMsImV4cCI6MjA5MjQ5NTI4M30.hrpMBj3Ev3r78imzFn7T2I4_9RFEV7NJKHNbec_cT_Y';

// Supabase 클라이언트 초기화
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 전역으로 사용할 수 있도록 window에 등록
window.supabaseClient = supabaseClient;

console.log('✅ Supabase 연결 완료');