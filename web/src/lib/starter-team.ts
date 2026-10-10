// Starter roster so the founder can assign consultations from day one. example.com addresses never receive mail:
// replace each email with the designer's real one on the Team page (that also removes the "Placeholder" badge).
export const STARTER_TEAM = [
  { name: "Meera Sathe", email: "meera.sathe@example.com", principal: true, specialty: "Villas and bungalows" },
  { name: "Aryan Joshi", email: "aryan.joshi@example.com", principal: false, specialty: "Full apartments" },
  { name: "Kavya Rao", email: "kavya.rao@example.com", principal: false, specialty: "Kitchens and wardrobes" },
  { name: "Rohan Pathak", email: "rohan.pathak@example.com", principal: false, specialty: "Offices and clinics" },
  { name: "Isha Bhide", email: "isha.bhide@example.com", principal: false, specialty: "Bedrooms and living rooms" },
  { name: "Farhan Shaikh", email: "farhan.shaikh@example.com", principal: false, specialty: "Apartments and renovations" },
] as const;
