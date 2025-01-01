import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ConditionCheckCard() {
  return (
    <Card className="bg-[#466D6D] text-white">
      <CardContent className="p-6">
        <h3 className="mb-2 text-lg font-bold">Explore Support Resources</h3>
        <p className="mb-4">
          Did you know? Having access to the right resources can increase your
          chances of recovery by 70%. Discover personalized support options
          tailored for you.
        </p>

        <div className="mt-4 flex justify-between items-center">
          <Button asChild className="bg-teal-600 hover:bg-teal-700">
            <Link href="/dashboard/resources">Browse Resources</Link>
          </Button>
          <Image
            src="/dashboard/watering-can.png"
            alt="Growth and Support Illustration"
            width={100}
            height={100}
            className="opacity-90"
          />
        </div>
      </CardContent>
    </Card>
  );
} 