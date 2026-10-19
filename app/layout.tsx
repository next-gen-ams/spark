import './globals.css';

export const metadata = {
  title: 'EMT Tracker',
  description:
    'Weekly GMS executive discussions, decisions, ownership and Microsoft-connected reminders.',
};

const directionContract = `THESIS: A weekly decision ledger makes every topic travel visibly from agenda to editable decision to named follow-up owner; it refuses the generic metric-card dashboard.
OWN-WORLD: GMS Active Blue identity, Mist navigation, Orange primary actions and Sky frosted working surfaces with the authentic GMS anniversary logo.
STORY: Executives see the next meeting date and simple day countdown, review the agenda, then maintain decisions and named follow-up actions in each discussion while personal reminder preferences stay in one global settings view; records older than two months archive automatically but remain fuzzy-searchable.
FIRST VIEWPORT: Active Blue brand header above a short left rail, one next-meeting date card, then the agenda ledger; Add topic is the primary action.
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
