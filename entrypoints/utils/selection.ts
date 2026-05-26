export function hasActiveTextSelection(selection: Selection | null = window.getSelection()): boolean {
    return Boolean(selection && selection.rangeCount > 0 && selection.toString().trim().length > 0);
}

