import { AdminDashboard } from '@/components/admin/admin-dashboard'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Admin · Enphera Compendium',
  robots: { index: false, follow: false },
}

export default function AdminPage() {
  return <AdminDashboard />
}
