export type RootStackParamList = {
  Login: undefined;
  FarmOverview: undefined;
  Dashboard: { farmId: number; farmName: string };
  AddEgg: { farmId: number };
  AddFeed: { farmId: number };
  AddSale: { farmId: number };
};
