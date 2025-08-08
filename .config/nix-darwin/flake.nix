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
          pkgs.slack
        ];

      homebrew = {
        enable = true;
        brews = [
	        "batt"
	        "ollama"
        ];
        casks = [
	        "ghostty"
	        "arc"
	        "zen"
	        "raycast"
	        "claude-code"
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
      
      system.primaryUser = "Rokas";
      system.defaults = {
        dock.autohide = true;
        finder.AppleShowAllExtensions = true;
        NSGlobalDomain."com.apple.swipescrolldirection" = false;
        NSGlobalDomain.AppleInterfaceStyle = "Dark";
      };

      # The platform the configuration will be used on.
      nixpkgs.hostPlatform = "aarch64-darwin";
    };
  in
  {
    # Build darwin flake using:
    # $ darwin-rebuild build --flake .#dzonatan-m4
    darwinConfigurations."dzonatan-m4" = nix-darwin.lib.darwinSystem {
      modules = [ configuration ];
    };
  };
}
