import Link from 'next/link';
import { getSession } from '@/lib/session';

export async function NavBar() {
  const session = await getSession();

  return (
    <header className="topbar">
      <div className="container row between center">
        <Link href="/" className="brand">JB Collections</Link>
        <nav className="row gap-sm wrap">
          <Link href="/dashboard">Dashboard</Link>
          {session && <Link href="/messages">Messages</Link>}
          {session && <Link href="/profile">Profile</Link>}
          {session?.role === 'ADMIN' && <Link href="/admin">Admin</Link>}
          {!session ? (
            <>
              <Link href="/login">Login</Link>
              <Link href="/signup" className="button small">Sign up</Link>
            </>
          ) : (
            <form action="/api/auth/logout" method="post">
              <button className="button ghost small" type="submit">Logout</button>
            </form>
          )}
        </nav>
      </div>
    </header>
  );
}
