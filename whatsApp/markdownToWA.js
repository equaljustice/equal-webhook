export function convertMarkdownToWhatsApp(markdownText) {
    // Use marked to parse markdown and extract the plain text with emphasis
    let formattedText = markdownText;

    // Replace ** or __ (bold) with WhatsApp single * emphasis
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '*$1*'); // Convert bold
    formattedText = formattedText.replace(/__(.*?)__/g, '*$1*'); // Convert bold (alternate)

    // Replace * or _ (italic) with WhatsApp single * emphasis
    formattedText = formattedText.replace(/\*(.*?)\*/g, '*$1*'); // Convert italic
    formattedText = formattedText.replace(/_(.*?)_/g, '*$1*'); // Convert italic (alternate)

    // Remove any remaining markdown that isn't supported (e.g., headings, links, etc.)
    formattedText = formattedText.replace(/[#>!\[\]]/g, ''); // Strip unwanted markdown symbols

    return formattedText;
}