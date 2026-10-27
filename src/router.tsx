import { createBrowserRouter } from "react-router-dom"
import Layout from "@/pages/_layout"
import HomePage from "@/pages/home"
import EmployeesPage from "@/pages/employees"
import OverviewPage from "@/pages/overview"
import PayrollDashboardPage from "@/pages/payroll"
import PayrollPeriodPage from "@/pages/payroll-period"
import PayrollTemplatesPage from "@/pages/payroll-templates"
import MyPayrollPage from "@/pages/my-payroll"
import PayslipPage from "@/pages/payslip"
import NotFoundPage from "@/pages/not-found"
import LeavePage from "@/pages/leave"
import LeaveHistoryPage from "@/pages/leave-history"
import LeaveConversionPage from "@/pages/leave-conversion"
import { AdminOnly } from "@/features/payroll/role-gate"

// IMPORTANT: Do not remove or modify the code below!
// Normalize basename when hosted in Power Apps
const BASENAME = new URL(".", location.href).pathname
if (location.pathname.endsWith("/index.html")) {
  history.replaceState(null, "", BASENAME + location.search + location.hash);
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "overview", element: <AdminOnly><OverviewPage /></AdminOnly> },
      { path: "employees", element: <AdminOnly><EmployeesPage /></AdminOnly> },
      { path: "leave", element: <LeavePage /> },
      { path: "leave-conversion", element: <LeaveConversionPage /> },
      { path: "leave-conversion/:year", element: <LeaveConversionPage /> },
      { path: "payroll", element: <AdminOnly><PayrollDashboardPage /></AdminOnly> },
      { path: "payroll/templates", element: <AdminOnly><PayrollTemplatesPage /></AdminOnly> },
      { path: "payroll/:periodId", element: <AdminOnly><PayrollPeriodPage /></AdminOnly> },
      { path: "my-payroll", element: <MyPayrollPage /> },
      { path: "leave-history", element: <LeaveHistoryPage /> },
      { path: "my-payroll/:entryId", element: <PayslipPage /> },
    ],
  },
], { 
  basename: BASENAME // IMPORTANT: Set basename for proper routing when hosted in Power Apps
})
