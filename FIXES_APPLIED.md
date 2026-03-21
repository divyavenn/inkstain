Read view fixes

1) as soon as you highlight, it should show a green comment. if you press the arrow key, it should toggle red and green. if you start typing, words should appear in the margins.

2) you should be able to click on the text, get a blinking cursor, erase/retype text, and propose edits in that way.

3) you should be able to click on comments, edits, highlights, and press backspace to delete them

4) if you click on the comment text in the margins, you should be able to edit it. 

author dashboard fixes:

1) by default, the comment pane + page should only show feedback that was added to THIS commit
2) if you click on a highlight or manually highlight some text, it should show, in the comment pane, feedback on the selected text from all versions, starting with most recent at the top, with thin gray lines separating which version each feedback comes from. to manage this, use an atom called "selectedText". clicking on a highlight sets selectedText to that highlight. manually highlighting text also sets selectedtext to that highlight,

1) the heatmap should show word by word reactions, the total likes and dislikes from all versions where that text ream