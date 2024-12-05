export type Pose = {
  position: {
    x: number;
    y: number;
    z: number;
  };
  rotation: {
    x: number;
    y: number;
    z: number;
    w: number;
  };
};

export type FlatPose = {
  px: number;
  py: number;
  pz: number;
  rx: number;
  ry: number;
  rz: number;
  rw: number;
};
