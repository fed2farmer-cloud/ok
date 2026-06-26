export const lordsFarmsDeal = {
  id: "SL-LF-0001",
  borrower: "Lords Farms LLC",
  title: "Lords Farms Regenerative Agritourism Farm",
  location: "Palmdale, California · Antelope Valley",
  website: "https://lordsfarms.com",
  property: "20-acre farm project with organic crops, poultry, aquaculture, canals, cabins, and agritourism experiences.",
  useOfFunds: "Land improvements, irrigation infrastructure, equipment, livestock materials, and launch operations.",
  fundingGoal: 40000,
  alreadyFunded: 10000,
  leadInvestor: "Melvin Askew",
  rate: 9,
  ltv: 50,
  termMonths: 24,
  grade: "A-",
  status: "Current Investment",
  collateral: "Land-backed loan with title, ownership, bank, and property-data verification workflow.",
};

export const money = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const percentFunded = Math.round((lordsFarmsDeal.alreadyFunded / lordsFarmsDeal.fundingGoal) * 100);
export const remainingFunding = lordsFarmsDeal.fundingGoal - lordsFarmsDeal.alreadyFunded;
