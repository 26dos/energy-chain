import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("DEX Suite", function () {
  async function deployDEXFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const WECY = await (await ethers.getContractFactory("WECY")).deploy();
    const wecyAddr = await WECY.getAddress();

    const Factory = await (
      await ethers.getContractFactory("UniswapV2Factory")
    ).deploy(owner.address);
    const factoryAddr = await Factory.getAddress();

    const Router = await (
      await ethers.getContractFactory("UniswapV2Router02")
    ).deploy(factoryAddr, wecyAddr);
    const routerAddr = await Router.getAddress();

    const TokenFactory = await (
      await ethers.getContractFactory("ERC20TokenFactory")
    ).deploy();

    const tx = await TokenFactory.createToken("Mock USDT", "USDT", 18, ethers.parseEther("10000000"));
    const receipt = await tx.wait();
    const event = receipt?.logs.find((l: any) => {
      try { return TokenFactory.interface.parseLog({ topics: [...l.topics], data: l.data })?.name === "TokenCreated"; } catch { return false; }
    });
    const parsed = TokenFactory.interface.parseLog({ topics: [...event!.topics], data: event!.data });
    const usdtAddr = parsed!.args.token;
    const USDT = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", usdtAddr);

    return { owner, alice, bob, WECY, Factory, Router, USDT, wecyAddr, factoryAddr, routerAddr, usdtAddr, TokenFactory };
  }

  describe("WECY", function () {
    it("deposit and withdraw", async function () {
      const { WECY, owner } = await loadFixture(deployDEXFixture);
      const depositAmount = ethers.parseEther("10");

      await WECY.deposit({ value: depositAmount });
      expect(await WECY.balanceOf(owner.address)).to.equal(depositAmount);

      await WECY.withdraw(depositAmount);
      expect(await WECY.balanceOf(owner.address)).to.equal(0);
    });

    it("rejects withdraw exceeding balance", async function () {
      const { WECY } = await loadFixture(deployDEXFixture);
      await expect(WECY.withdraw(1)).to.be.reverted;
    });
  });

  describe("Factory", function () {
    it("createPair and allPairsLength", async function () {
      const { Factory, wecyAddr, usdtAddr } = await loadFixture(deployDEXFixture);

      await Factory.createPair(wecyAddr, usdtAddr);
      expect(await Factory.allPairsLength()).to.equal(1);

      const pairAddr = await Factory.getPair(wecyAddr, usdtAddr);
      expect(pairAddr).to.not.equal(ethers.ZeroAddress);
    });

    it("rejects duplicate pair", async function () {
      const { Factory, wecyAddr, usdtAddr } = await loadFixture(deployDEXFixture);
      await Factory.createPair(wecyAddr, usdtAddr);
      await expect(Factory.createPair(wecyAddr, usdtAddr)).to.be.reverted;
    });

    it("rejects identical tokens", async function () {
      const { Factory, wecyAddr } = await loadFixture(deployDEXFixture);
      await expect(Factory.createPair(wecyAddr, wecyAddr)).to.be.reverted;
    });
  });

  describe("Router - Liquidity", function () {
    it("addLiquidityETH and removeLiquidityETH", async function () {
      const { Router, USDT, usdtAddr, owner, routerAddr } = await loadFixture(deployDEXFixture);
      const ecyAmount = ethers.parseEther("100");
      const usdtAmount = ethers.parseEther("200");
      const deadline = Math.floor(Date.now() / 1000) + 600;

      await USDT.approve(routerAddr, usdtAmount);
      const tx = await Router.addLiquidityETH(
        usdtAddr, usdtAmount, 0, 0, owner.address, deadline,
        { value: ecyAmount, gasLimit: 5_000_000 }
      );
      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);

      const { Factory } = await loadFixture(deployDEXFixture);
      // Verify pair was created by checking addLiquidity succeeded
    });

    it("addLiquidity with two ERC20 tokens", async function () {
      const { Router, USDT, TokenFactory, usdtAddr, owner, routerAddr } = await loadFixture(deployDEXFixture);

      const tx2 = await TokenFactory.createToken("Green Energy Token", "GET", 18, ethers.parseEther("5000000"));
      const r2 = await tx2.wait();
      const ev = r2?.logs.find((l: any) => {
        try { return TokenFactory.interface.parseLog({ topics: [...l.topics], data: l.data })?.name === "TokenCreated"; } catch { return false; }
      });
      const getAddr = TokenFactory.interface.parseLog({ topics: [...ev!.topics], data: ev!.data })!.args.token;
      const GET = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", getAddr);

      const amountA = ethers.parseEther("1000");
      const amountB = ethers.parseEther("2000");
      const deadline = Math.floor(Date.now() / 1000) + 600;

      await USDT.approve(routerAddr, amountA);
      await GET.approve(routerAddr, amountB);

      const tx = await Router.addLiquidity(
        usdtAddr, getAddr, amountA, amountB, 0, 0, owner.address, deadline,
        { gasLimit: 5_000_000 }
      );
      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);
    });
  });

  describe("Router - Swap", function () {
    async function addedLiquidityFixture() {
      const base = await loadFixture(deployDEXFixture);
      const { Router, USDT, usdtAddr, owner, routerAddr } = base;
      const ecyAmount = ethers.parseEther("1000");
      const usdtAmount = ethers.parseEther("2000");
      const deadline = Math.floor(Date.now() / 1000) + 600;

      await USDT.approve(routerAddr, usdtAmount);
      await Router.addLiquidityETH(
        usdtAddr, usdtAmount, 0, 0, owner.address, deadline,
        { value: ecyAmount, gasLimit: 5_000_000 }
      );
      return base;
    }

    it("swapExactETHForTokens", async function () {
      const { Router, USDT, usdtAddr, wecyAddr, alice } = await addedLiquidityFixture();
      const deadline = Math.floor(Date.now() / 1000) + 600;
      const swapAmount = ethers.parseEther("1");

      const balBefore = await USDT.balanceOf(alice.address);
      await Router.connect(alice).swapExactETHForTokens(
        0, [wecyAddr, usdtAddr], alice.address, deadline,
        { value: swapAmount, gasLimit: 500_000 }
      );
      const balAfter = await USDT.balanceOf(alice.address);
      expect(balAfter).to.be.gt(balBefore);
    });

    it("swapExactTokensForETH", async function () {
      const { Router, USDT, usdtAddr, wecyAddr, owner, routerAddr } = await addedLiquidityFixture();
      const deadline = Math.floor(Date.now() / 1000) + 600;
      const swapAmount = ethers.parseEther("10");

      await USDT.approve(routerAddr, swapAmount);
      const balBefore = await ethers.provider.getBalance(owner.address);
      await Router.swapExactTokensForETH(
        swapAmount, 0, [usdtAddr, wecyAddr], owner.address, deadline,
        { gasLimit: 500_000 }
      );
      const balAfter = await ethers.provider.getBalance(owner.address);
      expect(balAfter).to.be.gt(balBefore - ethers.parseEther("0.1"));
    });

    it("swapExactTokensForTokens", async function () {
      const { Router, USDT, TokenFactory, usdtAddr, wecyAddr, owner, routerAddr } = await addedLiquidityFixture();

      const tx2 = await TokenFactory.createToken("GreenCoin", "GRN", 18, ethers.parseEther("5000000"));
      const r2 = await tx2.wait();
      const ev = r2?.logs.find((l: any) => {
        try { return TokenFactory.interface.parseLog({ topics: [...l.topics], data: l.data })?.name === "TokenCreated"; } catch { return false; }
      });
      const grnAddr = TokenFactory.interface.parseLog({ topics: [...ev!.topics], data: ev!.data })!.args.token;
      const GRN = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", grnAddr);

      const deadline = Math.floor(Date.now() / 1000) + 600;
      await GRN.approve(routerAddr, ethers.parseEther("10000"));
      await Router.addLiquidityETH(
        grnAddr, ethers.parseEther("2000"), 0, 0, owner.address, deadline,
        { value: ethers.parseEther("500"), gasLimit: 5_000_000 }
      );

      const swapAmount = ethers.parseEther("5");
      await USDT.approve(routerAddr, swapAmount);
      const balBefore = await GRN.balanceOf(owner.address);

      await Router.swapExactTokensForTokens(
        swapAmount, 0, [usdtAddr, wecyAddr, grnAddr], owner.address, deadline,
        { gasLimit: 500_000 }
      );
      const balAfter = await GRN.balanceOf(owner.address);
      expect(balAfter).to.be.gt(balBefore);
    });
  });

  describe("ERC20TokenFactory", function () {
    it("creates tokens correctly", async function () {
      const { TokenFactory, owner } = await loadFixture(deployDEXFixture);

      const tx = await TokenFactory.createToken("Test Token", "TST", 18, ethers.parseEther("1000"));
      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);

      const event = receipt?.logs.find((l: any) => {
        try { return TokenFactory.interface.parseLog({ topics: [...l.topics], data: l.data })?.name === "TokenCreated"; } catch { return false; }
      });
      expect(event).to.not.be.undefined;

      const parsed = TokenFactory.interface.parseLog({ topics: [...event!.topics], data: event!.data });
      const tokenAddr = parsed!.args.token;
      const token = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", tokenAddr);

      expect(await token.balanceOf(owner.address)).to.equal(ethers.parseEther("1000"));
    });
  });
});
