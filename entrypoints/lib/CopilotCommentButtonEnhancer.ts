import type { IdeTarget } from './ideConfig';

export class CopilotCommentButtonEnhancer {
  private static readonly BUTTON_TEXT = 'Fix with Copilot';

  private static readonly AUTOMATED_COMMENT_SELECTOR =
    '[data-testid="automated-review-comment"]';

  private static readonly COMMENT_CONTAINER_SELECTOR =
    `${CopilotCommentButtonEnhancer.AUTOMATED_COMMENT_SELECTOR}, ` +
    '[class*="AutomatedReviewThreadComment-module__automatedComment__body"]';

  private static readonly COMMENT_BODY_SELECTOR =
    '[class*="automatedComment__content"]';

  private static readonly BUTTON_SELECTOR = 'button';

  private refreshTimer: number | undefined;
  private readonly pendingRefreshRoots = new Set<ParentNode>();
  private observer: MutationObserver | undefined;

  constructor(private readonly ideTargets: IdeTarget[]) {}

  run() {
    this.enhanceCopilotButtons();
    this.startObserver();

    window.addEventListener('popstate', () => {
      this.queueRefresh();
    });
    document.addEventListener('turbo:load', () => this.queueRefresh());
  }

  private handleMutations(mutations: MutationRecord[]) {
    const roots: ParentNode[] = [];

    for (const mutation of mutations) {
      // GitHub often fills an existing comment body after mounting its container.
      // Include the enclosing comment even when only text or a child is added.
      const target =
        mutation.target instanceof Element
          ? mutation.target
          : mutation.target.parentElement;
      if (target) {
        roots.push(target);
      }

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

  private startObserver() {
    this.observer?.disconnect();

    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    // Timelines and <main> are replaced during GitHub's client-side navigation.
    this.observer.observe(document.documentElement, {
      childList: true,
      characterData: true,
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
      parts.push(`#file:${filePath}`);
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
        const enclosingComment = root.closest<HTMLElement>(
          CopilotCommentButtonEnhancer.COMMENT_CONTAINER_SELECTOR,
        );
        if (enclosingComment) {
          containers.add(enclosingComment);
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

    // Older markup can match both the outer comment and its nested body.
    return Array.from(
      new Set(
        Array.from(
          containers,
          (container) =>
            container.closest<HTMLElement>(
              CopilotCommentButtonEnhancer.AUTOMATED_COMMENT_SELECTOR,
            ) ?? container,
        ),
      ),
    );
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

      const anchorButton =
        copilotButton ??
        actionButtons.find(
          (button) =>
            button.getAttribute('data-component') !== 'IconButton' &&
            this.normalizeText(button.textContent).length > 0,
        );

      for (const target of this.ideTargets) {
        const injectedAttr = `data-fix-in-${target.id}-injected`;
        const href = target.buildHref(prompt);
        const existingButton = buttonRow.querySelector<HTMLAnchorElement>(
          `[${injectedAttr}="true"]`,
        );
        if (existingButton) {
          if (existingButton.getAttribute('href') !== href) {
            existingButton.href = href;
          }
          continue;
        }

        const ideButton = this.createIdeButton(anchorButton, target, href);
        buttonRow.appendChild(ideButton);
      }
    }
  }

  private queueRefresh(roots: ParentNode[] = [document]) {
    for (const root of roots) {
      this.pendingRefreshRoots.add(root);
    }

    if (this.refreshTimer !== undefined) {
      return;
    }

    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = undefined;
      const refreshRoots =
        this.pendingRefreshRoots.size > 0
          ? Array.from(this.pendingRefreshRoots)
          : [document];
      this.pendingRefreshRoots.clear();
      this.enhanceCopilotButtons(refreshRoots);
    }, 150);
  }
}
