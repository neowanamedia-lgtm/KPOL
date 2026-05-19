import { Shell } from "@/components/Shell";
import { OrientationGuard } from "@/components/OrientationGuard";

export default function Page() {
  return (
    <OrientationGuard>
      <Shell />
    </OrientationGuard>
  );
}
