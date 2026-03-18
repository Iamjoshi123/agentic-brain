import AdminLoginClient from "./login-client";

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams?: { invite?: string };
}) {
  return <AdminLoginClient inviteToken={searchParams?.invite} />;
}
