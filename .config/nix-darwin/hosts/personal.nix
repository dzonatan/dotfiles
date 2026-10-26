{ pkgs, ... }: {
  environment.systemPackages = [
    pkgs.keepassxc
    pkgs.openscad-unstable
    pkgs.google-chrome
  ];
}
