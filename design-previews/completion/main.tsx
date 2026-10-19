import * as React from 'react';
import { createRoot } from 'react-dom/client';
import Home from '../../app/page';
import '../../app/globals.css';

function Preview() {
  const openExample = (completed = false) => {
    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>('button.decision-row'),
    ];
    const target = buttons.find((button) =>
      button.textContent?.includes(
        completed
          ? 'Confirm the team leave calendar'
          : 'Update the team onboarding checklist',
      ),
    );
    target?.click();
    setTimeout(
      () =>
        [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
          .find((button) => button.textContent === 'Decision')
          ?.click(),
      100,
    );
  };
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (document.querySelector('button.decision-row')) {
        clearInterval(timer);
        openExample();
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);
  return (
    <>
      <div className="completion-preview-bar">
        <span>
          <strong>LOCAL PREVIEW</strong> · Sample data · Changes stay on this
          device
        </span>
        <div>
          <button onClick={() => openExample()}>Open example</button>
          <button onClick={() => openExample(true)}>Completed example</button>
          <button
            onClick={() => {
              localStorage.removeItem('emt-completion-visual-preview-v1');
              location.reload();
            }}
          >
            Reset preview
          </button>
        </div>
      </div>
      <Home />
    </>
  );
}
if (!location.search) history.replaceState({}, '', '?view=decisions');
const style = document.createElement('style');
style.textContent = `.completion-preview-bar{font-family:'DM Sans',sans-serif;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 22px;background:#fff0ea;color:#464546;font-size:12px;border-bottom:1px solid #f3d1c2}.completion-preview-bar strong{color:#a33711;letter-spacing:.05em}.completion-preview-bar div{display:flex;gap:8px}.completion-preview-bar button{padding:6px 10px;border:1px solid #e4bbab;border-radius:7px;background:white;color:#464546;cursor:pointer}.completion-preview-bar button:focus-visible{outline:3px solid #007fc8;outline-offset:2px}@media(max-width:680px){.completion-preview-bar{align-items:flex-start;flex-direction:column;padding:10px 14px}}`;
document.head.appendChild(style);
createRoot(document.getElementById('root')!).render(<Preview />);
