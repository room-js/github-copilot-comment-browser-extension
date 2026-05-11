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

  constructor(private readonly ideTargets: IdeTarget[]) {}

  run() {
    this.enhanceCopilotButtons();

    const observer = new MutationObserver(() => {
      this.queueRefresh();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    window.addEventListener('popstate', () => {
      this.queueRefresh();
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
    anchorButton: HTMLElement,
    target: IdeTarget,
    href: string,
  ) {
    const link = document.createElement('a');
    link.textContent = target.label;
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    for (const attribute of Array.from(anchorButton.attributes)) {
      if (attribute.name.startsWith('data-')) {
        link.setAttribute(attribute.name, attribute.value);
      }
    }

    link.setAttribute(`data-fix-in-${target.id}-injected`, 'true');
    link.className = anchorButton.className;
    link.setAttribute('aria-label', target.ariaLabel);
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

  private enhanceCopilotButtons() {
    if (!this.isPullRequestPage()) {
      return;
    }

    const commentContainers = Array.from(
      document.querySelectorAll<HTMLElement>(
        CopilotCommentButtonEnhancer.COMMENT_CONTAINER_SELECTOR,
      ),
    );

    for (const container of commentContainers) {
      const commentText = this.extractCommentText(container);
      const filePath = this.extractFilePath(container);
      const prompt = this.buildPrompt(commentText, filePath);
      const actionButtons = Array.from(
        container.querySelectorAll<HTMLElement>(
          CopilotCommentButtonEnhancer.BUTTON_SELECTOR,
        ),
      );

      for (const button of actionButtons) {
        if (
          this.normalizeText(button.textContent) !==
          CopilotCommentButtonEnhancer.BUTTON_TEXT
        ) {
          continue;
        }

        for (const target of this.ideTargets) {
          const injectedAttr = `data-fix-in-${target.id}-injected`;
          const buttonRow = this.ensureButtonRow(button);
          if (buttonRow?.querySelector(`[${injectedAttr}="true"]`)) {
            continue;
          }

          const href = target.buildHref(prompt);
          const ideButton = this.createIdeButton(button, target, href);
          buttonRow?.appendChild(ideButton);
        }
      }
    }
  }

  private queueRefresh() {
    if (this.refreshTimer) {
      window.clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = window.setTimeout(() => {
      this.enhanceCopilotButtons();
    }, 150);
  }
}
