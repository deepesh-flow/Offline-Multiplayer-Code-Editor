// Collab helper utilities: User identity, language detection, and remote cursor styling

export const USER_COLORS = [
  '#FF5722', // Deep Orange
  '#4CAF50', // Green
  '#2196F3', // Blue
  '#9C27B0', // Purple
  '#E91E63', // Pink
  '#FF9800', // Amber
  '#00BCD4', // Cyan
  '#8BC34A', // Light Green
  '#3F51B5', // Indigo
  '#F44336', // Red
];

const ANIMAL_NAMES = [
  'Panda', 'Falcon', 'Cheetah', 'Otter', 'Fox', 'Koala', 
  'Eagle', 'Wolf', 'Lynx', 'Badger', 'Dolphin', 'Tiger'
];

export function getRandomUser() {
  const randomAnimal = ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)];
  const randomColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
  const randomNum = Math.floor(10 + Math.random() * 90);
  return {
    name: `Coder ${randomAnimal} ${randomNum}`,
    color: randomColor,
  };
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('h9_user_profile');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.name && parsed.color) return parsed;
    }
  } catch (e) {
    console.warn('Could not read user profile from localStorage', e);
  }
  const generated = getRandomUser();
  saveStoredUser(generated);
  return generated;
}

export function saveStoredUser(user) {
  try {
    localStorage.setItem('h9_user_profile', JSON.stringify(user));
  } catch (e) {
    console.warn('Could not save user profile', e);
  }
}

export function getLanguageByFilename(filename = '') {
  const ext = filename.split('.').pop().toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'py':
      return 'python';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
    case 'scss':
    case 'less':
      return 'css';
    case 'json':
      return 'json';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'cpp':
    case 'cc':
    case 'c':
    case 'h':
    case 'hpp':
      return 'cpp';
    case 'java':
      return 'java';
    case 'sql':
      return 'sql';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'xml':
    case 'svg':
      return 'xml';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'yaml':
    case 'yml':
      return 'yaml';
    default:
      return 'plaintext';
  }
}

/**
 * Dynamically injects remote cursor CSS styles for all active peers
 * based on the awareness state map.
 */
export function updateRemoteCursorStyles(awareness) {
  let styleEl = document.getElementById('yjs-remote-cursor-styles');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'yjs-remote-cursor-styles';
    document.head.appendChild(styleEl);
  }

  let cssRules = `
    /* Base styles for Yjs Monaco cursor & selection */
    .yRemoteSelection {
      opacity: 0.35;
      border-radius: 2px;
    }
    .yRemoteSelectionHead {
      position: absolute;
      box-sizing: border-box;
      height: 100%;
      border-left: 2px solid orange;
      z-index: 10;
    }
    .yRemoteSelectionHead::after,
    .yRemoteSelectionHead::before {
      position: absolute;
      content: ' ';
      border-radius: 3px;
      left: -2px;
      top: -1.4em;
      font-size: 11px;
      line-height: 1.2;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-weight: 600;
      padding: 1px 5px;
      color: #ffffff !important;
      pointer-events: none;
      white-space: nowrap;
      z-index: 20;
      box-shadow: 0 2px 4px rgba(0,0,0,0.4);
    }
  `;

  if (awareness) {
    const states = awareness.getStates();
    states.forEach((state, clientID) => {
      if (state && state.user) {
        const color = state.user.color || '#2196F3';
        const rawName = state.user.name || `User ${clientID}`;
        // Escape quotes to prevent CSS breakage
        const safeName = rawName.replace(/"/g, '\\"').replace(/'/g, "\\'");

        cssRules += `
          .yRemoteSelection-${clientID} {
            background-color: ${color} !important;
          }
          .yRemoteSelectionHead-${clientID} {
            border-left-color: ${color} !important;
          }
          .yRemoteSelectionHead-${clientID}::after,
          .yRemoteSelectionHead-${clientID}::before {
            content: "${safeName}" !important;
            background-color: ${color} !important;
          }
        `;
      }
    });
  }

  styleEl.textContent = cssRules;
}
