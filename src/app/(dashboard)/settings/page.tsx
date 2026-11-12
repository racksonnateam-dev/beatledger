import { PasswordForm, ProfileForm } from "@/components/settings/account-forms";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { engineHealth } from "@/lib/audio-service";
import { formatDate } from "@/lib/format";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const health = await engineHealth();
  const storage = process.env.STORAGE_DRIVER || "local";
  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Sign-in details, where files are stored, and the recognition engine currently configured on the audio service."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-medium">Profile</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {user.email} · joined {formatDate(user.createdAt)}
          </p>
          <div className="mt-5">
            <ProfileForm name={user.name ?? ""} />
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-base font-medium">Password</h2>
          <div className="mt-5">
            <PasswordForm />
          </div>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-base font-medium">Recognition engine</h2>
          <p className="mt-2 text-sm text-zinc-300">
            {health.online
              ? `${health.detail} Engine: ${health.engine}.`
              : health.detail}
          </p>
          <p className="mt-2 text-sm text-zinc-500">Storage driver: {storage}. Audio files are not placed in the public folder.</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-400">
            {(health.limitations.length > 0
              ? health.limitations
              : [
                  "The landmark engine is experimental and only compares files you upload.",
                  "A detection without a paid license is shown as Unverified license.",
                ]
            ).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
