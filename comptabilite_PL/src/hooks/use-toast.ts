// @ts-nocheck
// Minimal toast hook stub

// Standalone toast function
export const toast = ({ title, description, variant }: any) => {
  console.log(`Toast [${variant || 'default'}]:`, title, description);
  // In production, replace with actual toast implementation (e.g., react-hot-toast, sonner, etc.)
  alert(`${title}\n\n${description || ''}`);
};

// Hook version (returns object with toast method)
export const useToast = () => {
  return { toast };
};
