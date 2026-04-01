import { expect } from "chai";
import { ethers } from "hardhat";
import { EnergyDataAttestation } from "../typechain-types";

describe("EnergyDataAttestation", function () {
  let contract: EnergyDataAttestation;
  let owner: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("EnergyDataAttestation");
    contract = await factory.deploy();
  });

  describe("attest", function () {
    it("should store attestation and emit event", async function () {
      const data = ethers.toUtf8Bytes('{"meter":"M001","reading":12345,"ts":"2026-03-15T10:00:00Z"}');
      const hash = ethers.keccak256(data);

      const tx = await contract.connect(user1).attest(hash, "meter_reading", "电表M001读数");
      const receipt = await tx.wait();

      expect(await contract.totalAttestations()).to.equal(1);

      const att = await contract.getAttestation(1);
      expect(att.dataHash).to.equal(hash);
      expect(att.submitter).to.equal(user1.address);
      expect(att.dataType).to.equal("meter_reading");
      expect(att.memo).to.equal("电表M001读数");

      const events = receipt?.logs || [];
      expect(events.length).to.be.greaterThan(0);
    });

    it("should reject empty hash", async function () {
      await expect(
        contract.attest(ethers.ZeroHash, "test", "")
      ).to.be.revertedWith("empty hash");
    });

    it("should reject duplicate hash", async function () {
      const hash = ethers.keccak256(ethers.toUtf8Bytes("unique_data"));
      await contract.attest(hash, "test", "");
      await expect(
        contract.attest(hash, "test", "duplicate")
      ).to.be.revertedWith("hash already attested");
    });
  });

  describe("batchAttest", function () {
    it("should store multiple attestations in one tx", async function () {
      const hashes = [];
      for (let i = 0; i < 5; i++) {
        hashes.push(ethers.keccak256(ethers.toUtf8Bytes(`data_${i}`)));
      }

      const tx = await contract.connect(user1).batchAttest(hashes, "charging_order", "批量充电订单");
      await tx.wait();

      expect(await contract.totalAttestations()).to.equal(5);

      const ids = await contract.getAttestationsBySubmitter(user1.address);
      expect(ids.length).to.equal(5);

      const typeIds = await contract.getAttestationsByType("charging_order");
      expect(typeIds.length).to.equal(5);
    });

    it("should reject empty batch", async function () {
      await expect(
        contract.batchAttest([], "test", "")
      ).to.be.revertedWith("empty batch");
    });

    it("should reject batch larger than 100", async function () {
      const hashes = Array.from({ length: 101 }, (_, i) =>
        ethers.keccak256(ethers.toUtf8Bytes(`item_${i}`))
      );
      await expect(
        contract.batchAttest(hashes, "test", "")
      ).to.be.revertedWith("batch too large");
    });
  });

  describe("verifyByHash (溯源验证)", function () {
    it("should verify existing data", async function () {
      const rawData = '{"contract_id":"VPP-2026-001","parties":["A","B"],"amount":100000}';
      const data = ethers.toUtf8Bytes(rawData);
      const hash = ethers.keccak256(data);

      await contract.connect(user1).attest(hash, "vpp_contract", "虚拟电厂合同");

      const [exists, att] = await contract.verifyByHash(hash);
      expect(exists).to.be.true;
      expect(att.submitter).to.equal(user1.address);
      expect(att.dataType).to.equal("vpp_contract");
    });

    it("should return false for non-existent hash", async function () {
      const hash = ethers.keccak256(ethers.toUtf8Bytes("never_submitted"));
      const [exists] = await contract.verifyByHash(hash);
      expect(exists).to.be.false;
    });

    it("tampered data should fail verification", async function () {
      const original = '{"amount":100}';
      const tampered = '{"amount":999}';
      const originalHash = ethers.keccak256(ethers.toUtf8Bytes(original));
      const tamperedHash = ethers.keccak256(ethers.toUtf8Bytes(tampered));

      await contract.attest(originalHash, "settlement", "");

      const [exists1] = await contract.verifyByHash(originalHash);
      expect(exists1).to.be.true;

      const [exists2] = await contract.verifyByHash(tamperedHash);
      expect(exists2).to.be.false;
    });
  });

  describe("query", function () {
    it("should query by submitter", async function () {
      const h1 = ethers.keccak256(ethers.toUtf8Bytes("a"));
      const h2 = ethers.keccak256(ethers.toUtf8Bytes("b"));
      const h3 = ethers.keccak256(ethers.toUtf8Bytes("c"));

      await contract.connect(user1).attest(h1, "t1", "");
      await contract.connect(user2).attest(h2, "t1", "");
      await contract.connect(user1).attest(h3, "t2", "");

      const ids1 = await contract.getAttestationsBySubmitter(user1.address);
      expect(ids1.length).to.equal(2);

      const ids2 = await contract.getAttestationsBySubmitter(user2.address);
      expect(ids2.length).to.equal(1);
    });

    it("should query by type", async function () {
      const h1 = ethers.keccak256(ethers.toUtf8Bytes("x"));
      const h2 = ethers.keccak256(ethers.toUtf8Bytes("y"));

      await contract.connect(user1).attest(h1, "meter", "");
      await contract.connect(user2).attest(h2, "meter", "");

      const ids = await contract.getAttestationsByType("meter");
      expect(ids.length).to.equal(2);
    });
  });

  describe("computeHash", function () {
    it("should match ethers.keccak256", async function () {
      const raw = ethers.toUtf8Bytes("hello energy chain");
      const expected = ethers.keccak256(raw);
      const onchain = await contract.computeHash(raw);
      expect(onchain).to.equal(expected);
    });
  });
});
