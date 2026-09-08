import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GMS Executive Project Tracker',
  description:
    'Interactive mockup for fortnightly executive discussions, decisions, ownership and Microsoft-connected reminders.',
};

const directionContract = `THESIS: A fortnightly decision ledger makes every discussion travel visibly from agenda to owner to follow-up; it refuses the generic metric-card dashboard.
OWN-WORLD: GMS navy identity, warm-white navigation, action blue, and coral-sky-lavender frosted working surfaces with authentic GMS artwork.
STORY: Executives scan the next meeting, resolve missing ownership, open a topic, record a decision and confirm the reminder path.
FIRST VIEWPORT: Brand header above a short left rail, a chronological agenda ledger in the centre, and meeting-readiness controls at right; Add discussion is the primary action.
FORM: Grounded structure candidate 4, assigned by seed 5afa5f67.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const contractScript = `document.body.insertBefore(document.createComment(${JSON.stringify(directionContract)}), document.body.firstChild);`;

  return (
    <html lang="en">
      <body>
        <script dangerouslySetInnerHTML={{ __html: contractScript }} />
        {children}
      </body>
    </html>
  );
}
