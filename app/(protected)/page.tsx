import { AccountMenu } from "../components/AccountMenu";
import { RoadsideHelpTabs } from "../components/RoadsideHelpTabs";

/** Brand logo (myroadclub.com) */
const MRC_LOGO_URL =
  "https://myroadclub.com/wp-content/uploads/2025/10/IMG_7802-300x300.png";

export default function Home() {
  return (
    <main className="min-h-dvh">
      <header className="rounded-b-3xl border-b border-mrc-border bg-gradient-to-b from-white to-mrc-tint px-3 py-3 sm:px-5">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="justify-self-start">
            <img
              className="h-10 w-auto max-w-28"
              src={MRC_LOGO_URL}
              alt="My Road Club"
              width={300}
              height={300}
            />
          </div>
          <h1 className="hidden text-center text-lg font-semibold text-mrc-text sm:block">
            Welcome to <span className="text-mrc-primary">My Road Club</span>
          </h1>
          <div className="justify-self-end">
            <AccountMenu />
          </div>
        </div>
      </header>
      <section
        className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 md:py-6 lg:px-8"
        aria-label="Roadside assistance"
      >
        <RoadsideHelpTabs />
      </section>
    </main>
  );
}
