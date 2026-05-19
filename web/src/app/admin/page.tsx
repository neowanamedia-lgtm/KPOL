import { AdminDashboard } from "./AdminDashboard";

interface Props {
  searchParams: Promise<{ key?: string }>;
}

export default async function AdminPage({ searchParams }: Props) {
  const { key } = await searchParams;
  const expected = process.env.NEXT_PUBLIC_KPOL_ADMIN_KEY;

  if (!expected) {
    return (
      <main className="min-h-dvh bg-bg text-fg p-6 font-mono text-[13px]">
        <p>NEXT_PUBLIC_KPOL_ADMIN_KEY 환경 변수가 설정되어 있지 않습니다.</p>
        <p className="text-fg-dim mt-2">web/.env.local에 값을 추가하고 dev 서버를 재시작하세요.</p>
      </main>
    );
  }

  if (key !== expected) {
    return (
      <main className="min-h-dvh bg-bg text-fg p-6 font-mono text-[13px]">
        <p>접근 거부</p>
      </main>
    );
  }

  return <AdminDashboard />;
}
