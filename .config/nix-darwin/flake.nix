{
  description = "Example nix-darwin system flake";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    nix-darwin.url = "github:nix-darwin/nix-darwin/master";
    nix-darwin.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = inputs@{ self, nix-darwin, nixpkgs }:
  let
    mkHost = hostModule: nix-darwin.lib.darwinSystem {
      specialArgs = { inherit self; };
      modules = [ ./common.nix hostModule ];
    };
  in
  {
    # Build darwin flake using:
    # $ darwin-rebuild build --flake .#work
    # $ darwin-rebuild build --flake .#personal
    darwinConfigurations."work" = mkHost ./hosts/work.nix;
    darwinConfigurations."personal" = mkHost ./hosts/personal.nix;
  };
}
