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
          pkgs.zoxide
          pkgs.ripgrep
          pkgs.starship
          pkgs.zinit
          pkgs.tmux
          pkgs.fzf
          pkgs.fd
          pkgs.yazi
          pkgs.neovim
          pkgs.lazygit
          pkgs.bottom
          pkgs.gh
          pkgs.fnm
          pkgs.bun
          pkgs.pnpm
          pkgs.bitwarden-desktop
          pkgs.keepassxc
          pkgs.openscad-unstable

          # Rust
          pkgs.cargo

          # Container tools
          pkgs.podman
          pkgs.podman-compose
          pkgs.podman-tui
          pkgs.colima
          pkgs.docker
          pkgs.docker-compose
          pkgs.lazydocker

          #pi dependencies
          pkgs.bat
          pkgs.delta
          pkgs.glow

          # DBs
          pkgs.pgcli
          # pkgs.mycli # temporarily disabled: sqlglot version mismatch

          pkgs.awscli2
          pkgs.google-chrome
        ];

      homebrew = {
        enable = true;
        taps = [
          "nikitabobko/tap"
        ];
        brews = [
	        "ollama"
	        "llmfit"
	        "anomalyco/tap/opencode"
	        "agavra/tap/tuicr"
        ];
        casks = [
	        "ghostty"
	        "arc"
	        "raycast"
	        "claude-code@latest"
	        "yubico-authenticator"
	        "shottr"
	        "spotify"
	        "nikitabobko/tap/aerospace"
	        "signal"
	        "claude"
        ];
      };

      nixpkgs.config.allowUnfree = true;
      # Temporary: bitwarden-desktop still pins EOL Electron 39 upstream.
      # Track https://github.com/NixOS/nixpkgs/issues/526914 and remove once fixed.
      nixpkgs.config.permittedInsecurePackages = [ "electron-39.8.10" ];

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
        NSGlobalDomain.ApplePressAndHoldEnabled = false;
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
