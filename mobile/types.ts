export type RootStackParamList = {
  Login: undefined;
  FarmOverview: undefined;
  Dashboard: { farmId: number; farmName: string; myRole: string };
  AddEgg: { farmId: number };
  AddFeed: { farmId: number };
  AddSale: { farmId: number };
  AddExpense: { farmId: number };
  ProductionList: { farmId: number };
  FeedList: { farmId: number };
  SalesList: { farmId: number };
  ExpensesList: { farmId: number };
  Settings: { farmId: number; farmName: string; myRole: string };
  Audit: { farmId: number };
};
