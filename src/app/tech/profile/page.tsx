import { requireAuth } from '@/lib/auth/session';
import { UserCircle, LogOut } from 'lucide-react';

export const metadata = {
  title: 'Profile | AquaFlow Tech',
};

export default async function TechProfilePage() {
  const { user } = await requireAuth();

  return (
    <div className="flex flex-col min-h-screen">
      <header className="p-6 pt-12 pb-6 bg-secondary-bg/80 border-b border-border/50 sticky top-0 z-10 backdrop-blur-xl">
        <h1 className="text-2xl font-bold text-white tracking-tight">Profile</h1>
      </header>

      <div className="p-4 space-y-6">
        <div className="glass rounded-2xl p-6 border border-border/50 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-primary-blue/20 rounded-full flex items-center justify-center mb-4">
            <UserCircle className="w-10 h-10 text-primary-blue" />
          </div>
          <h2 className="text-xl font-bold text-white">{user.firstName} {user.lastName}</h2>
          <p className="text-muted-text">{user.email}</p>
        </div>

        <div className="w-full glass rounded-xl border border-danger/30 text-danger hover:bg-danger/10 transition-colors">
          <form method="POST" action="/api/auth/logout" className="w-full h-full">
            <button type="submit" className="w-full p-4 flex items-center justify-center font-bold outline-none">
              <LogOut className="w-5 h-5 mr-2" /> Sign Out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
