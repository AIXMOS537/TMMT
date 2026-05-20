/**
 * Client-safe re-exports — all fetches run as server actions (Command Center service role).
 */
export {
  rentalsGetDashboardData as getDashboardData,
  rentalsGetFleet as getFleet,
  rentalsGetLeads as getLeads,
  rentalsGetBackgroundChecks as getBackgroundChecks,
  rentalsGetWaitlist as getWaitlist,
  rentalsGetAppointments as getAppointments,
  rentalsGetActiveCustomers as getActiveCustomers,
  rentalsGetPayments as getPayments,
  rentalsGetInsurance as getInsurance,
  rentalsGetTickets as getTickets,
  rentalsGetExpenses as getExpenses,
  rentalsGetInspections as getInspections,
  rentalsGetContracts as getContracts,
  rentalsGetVendors as getVendors,
  rentalsGetOperationCosts as getOperationCosts,
  rentalsGetDoNotRent as getDoNotRent,
  rentalsGetFormerCustomers as getFormerCustomers,
  rentalsGetMaintenance as getMaintenance,
  rentalsGetAppointmentStats as getAppointmentStats,
  rentalsGetContractStats as getContractStats,
  rentalsGetVehicleStats as getVehicleStats,
  rentalsGetPaymentStats as getPaymentStats,
  rentalsAdminUpsert as adminUpsert,
} from "./actions";
