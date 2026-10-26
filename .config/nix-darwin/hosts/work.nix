{ pkgs, ... }: {
  environment.systemPackages = [
    pkgs.awscli2
  ];
}
