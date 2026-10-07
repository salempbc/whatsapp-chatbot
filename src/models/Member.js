import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true, // ✅ keep ONLY this (no separate index)
      trim: true
    },

    displayName: {
      type: String,
      trim: true,
      default: ""
    },

    gender: {
      type: String,
      enum: ["male", "female"],
      required: true
    },

    phone: {
      type: String,
      trim: true,
      default: "",
      index: true
    },

    address: {
      type: String,
      trim: true,
      default: ""
    },

    role: {
      type: String // pastor, elder, deacon, treasurer, secretary, youth leader, worship leader, member
    },

    ministry: {
      type: String, // worship, youth, sunday school, prayer, outreach, hospitality
      trim: true,
      default: ""
    },

    status: {
      type: String,
      enum: ["active", "inactive", "transferred", "deceased", "archived"],
      default: "active",
      index: true
    },

    membershipDate: {
      type: String, // YYYY-MM-DD
      default: ""
    },

    adminNotes: {
      type: String,
      default: ""
    },

    isChild: {
      type: Boolean,
      default: false
    },

    isPastor: {
      type: Boolean,
      default: false
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },

    /* 🏠 Attendance / operational status — kept synced with status */
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    /* 👨‍👩‍👧 Family group label (free text, e.g. "Kumar Family") */
    familyName: {
      type: String,
      trim: true,
      index: true
    },

    dob: {
      type: String // YYYY-MM-DD
    },

    birthday: {
      type: String, // MM-DD
      index: true
    },

    /**
     * 💍 Marriage Fields
     */
    isMarried: {
      type: Boolean,
      default: false
    },

    spouseName: {
      type: String,
      trim: true,
      default: ""
    },

    spouseGender: {
      type: String,
      enum: ["male", "female", null],
      default: null,
      set: (v) => (v === "" || !v ? null : v)
    },

    spouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      default: null,
      set: (v) => (v === "" || !v ? null : v)
    },

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      default: null,
      set: (v) => (v === "" || !v ? null : v)
    },

    weddingDate: {
      type: String // YYYY-MM-DD
    },

    wedding: {
      type: String, // MM-DD
      index: true
    },

    /* Telegram file_id of the member's photo */
    photo: {
      type: String
    },

    customData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

/* 🚀 PERFORMANCE: Compound indexes */
memberSchema.index({ isDeleted: 1, isActive: 1, birthday: 1 });
memberSchema.index({ isDeleted: 1, isActive: 1, wedding: 1 });
memberSchema.index({ familyName: 1, name: 1 });
memberSchema.index({ status: 1, isDeleted: 1 });

/**
 * 🔒 VALIDATION LOGIC
 */
memberSchema.pre("save", function () {
  // Sync isActive with lifecycle status
  if (this.status) {
    if (this.status === "active") {
      this.isActive = true;
      this.isDeleted = false;
    } else {
      this.isActive = false;
      if (this.status === "archived") {
        this.isDeleted = true;
      }
    }
  }

  if (this.isMarried) {
    // spouse required
    if (!this.spouseName || !this.spouseName.trim()) {
      throw new Error("Spouse name required for married members");
    }

    // gender pairing check
    if (this.gender && this.spouseGender && this.gender === this.spouseGender) {
      throw new Error("Invalid marriage: same gender pairing not allowed");
    }
  } else {
    this.spouseName = "";
    this.spouseGender = null;
    this.spouseId = null;
    this.weddingDate = "";
    this.wedding = "";
  }
});

memberSchema.pre("findOneAndUpdate", function () {
  const update = this.getUpdate();
  if (update) {
    const status = update.status || update.$set?.status;
    if (status) {
      if (status === "active") {
        this.set({ isActive: true, isDeleted: false });
      } else {
        this.set({ isActive: false });
        if (status === "archived") {
          this.set({ isDeleted: true });
        }
      }
    }
  }
});

const Member = mongoose.models.Member || mongoose.model("Member", memberSchema);

export default Member;