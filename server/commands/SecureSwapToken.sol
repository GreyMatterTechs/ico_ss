pragma solidity ^0.4.18;

// ERC Token Standard #20 Interface
interface ERC20 {
    // Get the total token supply
    function totalSupply() view external returns (uint256 ts);
    // Get the account balance of another account with address _owner
    function balanceOf(address _owner) view external returns (uint256 balance);
    // Send _value amount of tokens to address _to
    function transfer(address _to, uint256 _value) external returns (bool success);
    // Send _value amount of tokens from address _from to address _to
    function transferFrom(address _from, address _to, uint256 _value) external returns (bool success);
    // Allow _spender to withdraw from your account, multiple times, up to the _value amount.
    // If this function is called again it overwrites the current allowance with _value.
    // this function is required for some DEX functionality
    function approve(address _spender, uint256 _value) external returns (bool success);
    // Returns the amount which _spender is still allowed to withdraw from _owner
    function allowance(address _owner, address _spender) view external returns (uint256 remaining);
    // Triggered when tokens are transferred.
    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    // Triggered whenever approve(address _spender, uint256 _value) is called.
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);
}

// Owned contract
contract Owned {
    address private _ContractOwner = address(0);
    address private _NewOwner = address(0);

    event OwnershipTransferred(address indexed _from, address indexed _to);

    constructor() public{
        intialOwner(msg.sender);
    }

    modifier onlyOwner{
        require(msg.sender == _ContractOwner);
        _;
    }

    function intialOwner(address own) private{
        _ContractOwner = own;
    }

    function getContractOwner() public view returns(address){
        return _ContractOwner;
    }

    function transferOwnership(address newOwner) public onlyOwner{
        _NewOwner = newOwner;
    }

    function acceptOwnership() public {
        require(msg.sender == _NewOwner);
        emit OwnershipTransferred(_ContractOwner, _NewOwner);
        _ContractOwner = _NewOwner;
        _NewOwner = address(0);
    }
}

// ERC20 Token Smart contract
contract SecureSwapToken is ERC20, Owned{
    string public name = "SecureSwap";
    string public symbol = "SSW";
    uint8 public decimals = 18;
    uint256 private _totalSupply = 100000000000000000000000000; // 100 000 000 . 000 000 ...

    // Balances for each account
    mapping(address => uint256) balances;
    // Owner of account approves the transfer of an amount to another account
    mapping(address => mapping(address=>uint256)) allowed;

    // Constructor
    constructor() public{
        balances[msg.sender] = _totalSupply;
        emit Transfer(address(0), msg.sender, _totalSupply);
    }

    function totalSupply() view public returns(uint256){
        return _totalSupply;
    }

    // What is the balance of a particular account?
    function balanceOf(address _owner) view public returns(uint256){
        return balances[_owner];
    }

     // Transfer the balance from owner's account to another account   
    function transfer(address _to, uint256 _value) public returns (bool success){
        require(balances[msg.sender] >= _value && _value > 0);
        balances[msg.sender] = balances[msg.sender] - _value;
        balances[_to] = balances[_to] + _value;
        emit Transfer(msg.sender, _to, _value);
        return true;
    }
    
    // Send _value amount of tokens from address _from to address _to
    // The transferFrom method is used for a withdraw workflow, allowing contracts to send
    // tokens on your behalf, for example to "deposit" to a contract address and/or to charge
    // fees in sub-currencies; the command should fail unless the _from account has
    // deliberately authorized the sender of the message via some mechanism; we propose
    // these standardized APIs for approval:
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success){
        if (msg.sender == getContractOwner() || _from != getContractOwner()){
            require(allowed[_from][msg.sender] >= _value && balances[_from] >= _value && _value > 0);
            balances[_from] = balances[_from] - _value;
            balances[_to] = balances[_to] + _value;
            allowed[_from][msg.sender] = allowed[_from][msg.sender] - _value;
            emit Transfer(_from, _to, _value);
            return true;
        }
        return false;
    }
    
    // Allow _spender to withdraw from your account, multiple times, up to the _value amount.
    // If this function is called again it overwrites the current allowance with _value.
    function approve(address _spender, uint256 _value) public returns(bool){
        allowed[msg.sender][_spender] = _value; 
        emit Approval(msg.sender, _spender, _value);
        return true;
    }
    
    // Returns the amount which _spender is still allowed to withdraw from _owner
    function allowance(address _owner, address _spender) view public returns(uint256){
        return allowed[_owner][_spender];
    }
  
    function kill(address recipient) public onlyOwner returns(bool){
        selfdestruct(recipient);
        return true;
    }

    // Don't accept ETH
    function () public payable {
        revert();
    }

    // Owner can transfer out any accidentally sent ERC20 tokens
    function transferAnyERC20Token(address tokenAddress, uint tokens) public onlyOwner returns (bool success) {
        return ERC20(tokenAddress).transfer(getContractOwner(), tokens);
    }

    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);
}
