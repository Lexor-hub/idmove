// Quick test for KPI mapping logic used in SupervisorDashboard
const mapKpis = (kpis) => {
  const totalEntregas = Number(
    kpis?.today_deliveries?.total ?? kpis?.total_deliveries ?? kpis?.totalEntregas ?? 0
  );
  const entregasRealizadas = Number(
    kpis?.today_deliveries?.completed ?? kpis?.completed_deliveries ?? kpis?.entregasRealizadas ?? 0
  );
  const entregasPendentes = Number(
    kpis?.today_deliveries?.pending ?? kpis?.pending_deliveries ?? kpis?.entregasPendentes ?? 0
  );
  const motoristasAtivos = Number(kpis?.active_drivers ?? kpis?.motoristasAtivos ?? 0);
  return { totalEntregas, entregasRealizadas, entregasPendentes, motoristasAtivos };
};

const apiResponse = { success: true, data: { today_deliveries: { total: 12, completed: 8, pending: 4, in_progress: 0 }, active_drivers: 3, pending_occurrences: 1 } };
console.log(mapKpis(apiResponse.data));

const apiResponseOld = { success: true, data: { total_deliveries: 5, completed_deliveries: 2, pending_deliveries: 3, active_drivers: 1 } };
console.log(mapKpis(apiResponseOld.data));

const apiEmpty = { success: true, data: {} };
console.log(mapKpis(apiEmpty.data));
