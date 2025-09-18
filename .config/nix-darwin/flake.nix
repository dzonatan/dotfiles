{
  description = "Example nix-darwin system flake";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    nix-darwin.url = "github:nix-darwin/nix-darwin/master";
    nix-darwin.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = inputs@{ self, nix-darwin, nixpkgs }:
  let
    configuration = { pkgs, ... }: {
      # List packages installed in system profile. To search by name, run:
      # $ nix-env -qaP | grep wget
      environment.systemPackages =
        [
          pkgs.git
          pkgs.stow
          pkgs.jump
          pkgs.ripgrep
          pkgs.starship
          pkgs.zinit
          pkgs.fzf
          pkgs.yazi
          pkgs.neovim
          pkgs.lazygit
          pkgs.bottom
          pkgs.gh
          pkgs.nodejs_22
          pkgs.bun
          pkgs.pnpm
          pkgs.bitwarden-desktop
          pkgs.keepassxc
          pkgs.spotify
          pkgs.openscad-unstable
          pkgs.podman
          pkgs.podman-compose
          pkgs.podman-tui
          pkgs.amp-cli
        ];

      homebrew = {
        enable = true;
        taps = [
          "sst/tap"
        ];
        brews = [
	        "batt" # also read the notes to enable service https://github.com/charlie0129/batt
	        "ollama"
	        "sst/tap/opencode"
        ];
        casks = [
	        "ghostty"
	        "arc"
	        "raycast"
	        "claude-code"
	        "yubico-authenticator"
	        "shottr"
        ];
      };

      nixpkgs.config.allowUnfree = true;

      # Necessary for using flakes on this system.
      nix.settings.experimental-features = "nix-command flakes";

      # Enable alternative shell support in nix-darwin.
      # programs.fish.enable = true;

      # Set Git commit hash for darwin-version.
      system.configurationRevision = self.rev or self.dirtyRev or null;

      # TouchID instead of password
      security.pam.services.sudo_local.touchIdAuth = true;

      # Used for backwards compatibility, please read the changelog before changing.
      # $ darwin-rebuild changelog
      system.stateVersion = 6;

      system.keyboard.enableKeyMapping = true;
      system.keyboard.remapCapsLockToControl = true;

      system.primaryUser = "Rokas";
      system.defaults = {
        dock.autohide = true;

        finder.AppleShowAllExtensions = true;
        finder.ShowPathbar = true;

        NSGlobalDomain."com.apple.swipescrolldirection" = false;
        NSGlobalDomain.AppleInterfaceStyle = "Dark";
        NSGlobalDomain.KeyRepeat = 2;
        NSGlobalDomain.InitialKeyRepeat = 15;
 
        controlcenter.BatteryShowPercentage = true;
        controlcenter.Sound = true;
 
        CustomUserPreferences = {
          "NSGlobalDomain" = {
            NSQuitAlwaysKeepsWindows = true;
          };
          "com.apple.symbolichotkeys" = {
            AppleSymbolicHotKeys = {
              # Disable '^ + Space' for selecting the previous input source
              "60" = {
                enabled = false;
              };
              # Disable 'Cmd + Space' for Spotlight Search
              "64" = {
                enabled = false;
              };
            };
          };
        };
      };

      # The platform the configuration will be used on.
      nixpkgs.hostPlatform = "aarch64-darwin";
    };
  in
  {
    # Build darwin flake using:
    # $ darwin-rebuild build --flake .#dzonatan
    darwinConfigurations."dzonatan" = nix-darwin.lib.darwinSystem {
      modules = [ configuration ];
    };
  };
}
