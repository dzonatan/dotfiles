echo "I'm in yer computer, hax0ring yr passwords!"
echo "Requiring password immediately after sleep or screen saver begins"
defaults write com.apple.screensaver askForPassword -int 1
defaults write com.apple.screensaver askForPasswordDelay -int 0

echo "Disable two finger back/forward in Chrome"
defaults write com.google.Chrome.plist AppleEnableSwipeNavigateWithScrolls -bool FALSE
