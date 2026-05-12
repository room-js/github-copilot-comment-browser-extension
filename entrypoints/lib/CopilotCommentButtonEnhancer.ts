import type { IdeTarget } from './ideConfig';

export class CopilotCommentButtonEnhancer {
  private static readonly BUTTON_TEXT = 'Fix with Copilot';

  private static readonly COMMENT_CONTAINER_SELECTOR =
    'div[class*="AutomatedReviewThreadComment-module__automatedComment__body_"]';

  private static readonly COMMENT_BODY_SELECTOR =
    'div[class*="AutomatedReviewThreadComment-module__automatedComment__content_"]';

  private static readonly BUTTON_SELECTOR =
    'button[class*="prc-Button-ButtonBase-"]';

  private refreshTimer: number | undefined;
  private readonly pendingRefreshRoots = new Set<ParentNode>();
  private observer: MutationObserver | undefined;

  constructor(private readonly ideTargets: IdeTarget[]) {}

  run() {
    this.enhanceCopilotButtons();
    this.startObserver();

    window.addEventListener('popstate', () => {
      this.startObserver();
      this.queueRefresh();
    });
  }

  private handleMutations(mutations: MutationRecord[]) {
    const roots: ParentNode[] = [];

    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof Element || node instanceof DocumentFragment) {
          roots.push(node);
        }
      }
    }

    if (roots.length === 0) {
      return;
    }

    this.queueRefresh(roots);
  }

  private resolveObserverRoot() {
    return (
      document.querySelector<HTMLElement>('.pull-discussion-timeline') ??
      document.querySelector<HTMLElement>('main') ??
      document.body ??
      document.documentElement
    );
  }

  private startObserver() {
    this.observer?.disconnect();
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(this.resolveObserverRoot(), {
      childList: true,
      subtree: true,
    });
  }

  private isPullRequestPage() {
    return /^\/[^/]+\/[^/]+\/pull\/\d+/.test(window.location.pathname);
  }

  private normalizeText(value: string | null | undefined) {
    return (value ?? '').replace(/\s+/g, ' ').trim();
  }

  private extractCommentText(container: Element) {
    const content = container.querySelector(
      CopilotCommentButtonEnhancer.COMMENT_BODY_SELECTOR,
    );
    return this.normalizeText(content?.textContent);
  }

  private extractFilePath(node: Element) {
    const fileContainer = node.closest('[data-path]');
    const fromDataPath = fileContainer?.getAttribute('data-path');
    if (fromDataPath) {
      return fromDataPath;
    }

    const thread = node.closest('review-thread-collapsible');
    const fromDiffHeader =
      thread?.querySelector<HTMLAnchorElement>('a[href*="#diff-"]')
        ?.textContent ?? '';

    return this.normalizeText(fromDiffHeader);
  }

  private buildPrompt(commentText: string, filePath: string) {
    const parts: string[] = [];
    if (filePath.length > 0) {
      parts.push(`#filePath:${filePath}`);
    }
    parts.push(commentText);
    return parts.join('\n');
  }

  private createIdeButton(
    anchorButton: HTMLElement | undefined,
    target: IdeTarget,
    href: string,
  ) {
    const link = document.createElement('a');
    link.textContent = target.label;
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    if (anchorButton) {
      for (const attribute of Array.from(anchorButton.attributes)) {
        if (attribute.name.startsWith('data-')) {
          link.setAttribute(attribute.name, attribute.value);
        }
      }

      link.className = anchorButton.className;
    }

    link.setAttribute(`data-fix-in-${target.id}-injected`, 'true');
    link.setAttribute('aria-label', target.ariaLabel);
    link.style.width = 'auto';
    link.style.border = 'var(--borderWidth-thin,.0625rem) solid';
    link.style.borderColor = 'var(--button-default-borderColor-rest, #d1d9e0)';
    link.style.borderRadius = 'var(--borderRadius-medium, .375rem)';
    link.style.color = 'var(--button-default-fgColor-rest, #25292e)';
    return link;
  }

  private ensureButtonRow(button: HTMLElement) {
    const existingRow = button.closest<HTMLElement>(
      '[data-fix-in-button-row="true"]',
    );
    if (existingRow) {
      return existingRow;
    }

    const parent = button.parentElement;
    if (!parent) {
      return undefined;
    }

    const row = document.createElement('div');
    row.setAttribute('data-fix-in-button-row', 'true');
    row.style.display = 'inline-flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';

    parent.insertBefore(row, button);
    row.appendChild(button);

    return row;
  }

  private ensureFallbackButtonRow(container: HTMLElement) {
    const existingRow = container.querySelector<HTMLElement>(
      '[data-fix-in-button-row="true"]',
    );
    if (existingRow) {
      return existingRow;
    }

    const commentBody = container.querySelector<HTMLElement>(
      CopilotCommentButtonEnhancer.COMMENT_BODY_SELECTOR,
    );
    if (!commentBody?.parentElement) {
      return undefined;
    }

    const row = document.createElement('div');
    row.setAttribute('data-fix-in-button-row', 'true');
    row.style.display = 'inline-flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    row.style.marginTop = '8px';

    commentBody.insertAdjacentElement('afterend', row);
    return row;
  }

  private findCommentContainers(roots: ParentNode[]) {
    const containers = new Set<HTMLElement>();

    for (const root of roots) {
      if (root instanceof Element) {
        if (
          root.matches(CopilotCommentButtonEnhancer.COMMENT_CONTAINER_SELECTOR)
        ) {
          containers.add(root as HTMLElement);
        }

        for (const match of Array.from(
          root.querySelectorAll<HTMLElement>(
            CopilotCommentButtonEnhancer.COMMENT_CONTAINER_SELECTOR,
          ),
        )) {
          containers.add(match);
        }
        continue;
      }

      for (const match of Array.from(
        root.querySelectorAll<HTMLElement>(
          CopilotCommentButtonEnhancer.COMMENT_CONTAINER_SELECTOR,
        ),
      )) {
        containers.add(match);
      }
    }

    return Array.from(containers);
  }

  private enhanceCopilotButtons(roots: ParentNode[] = [document]) {
    if (!this.isPullRequestPage()) {
      return;
    }

    const commentContainers = this.findCommentContainers(roots);

    for (const container of commentContainers) {
      const commentText = this.extractCommentText(container);
      if (commentText.length === 0) {
        continue;
      }

      const filePath = this.extractFilePath(container);
      const prompt = this.buildPrompt(commentText, filePath);
      const actionButtons = Array.from(
        container.querySelectorAll<HTMLElement>(
          CopilotCommentButtonEnhancer.BUTTON_SELECTOR,
        ),
      );

      const copilotButton = actionButtons.find(
        (button) =>
          this.normalizeText(button.textContent) ===
          CopilotCommentButtonEnhancer.BUTTON_TEXT,
      );

      const buttonRow = copilotButton
        ? this.ensureButtonRow(copilotButton)
        : this.ensureFallbackButtonRow(container);
      if (!buttonRow) {
        continue;
      }

      const anchorButton = copilotButton ?? actionButtons[0];

      for (const target of this.ideTargets) {
        const injectedAttr = `data-fix-in-${target.id}-injected`;
        if (buttonRow.querySelector(`[${injectedAttr}="true"]`)) {
          continue;
        }

        const href = target.buildHref(prompt);
        const ideButton = this.createIdeButton(anchorButton, target, href);
        buttonRow.appendChild(ideButton);
      }
    }
  }

  private queueRefresh(roots: ParentNode[] = [document]) {
    for (const root of roots) {
      this.pendingRefreshRoots.add(root);
    }

    if (this.refreshTimer) {
      window.clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = window.setTimeout(() => {
      const refreshRoots =
        this.pendingRefreshRoots.size > 0
          ? Array.from(this.pendingRefreshRoots)
          : [document];
      this.pendingRefreshRoots.clear();
      this.enhanceCopilotButtons(refreshRoots);
    }, 150);
  }
}
