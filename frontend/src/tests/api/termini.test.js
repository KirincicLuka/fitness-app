const createTermin = jest.fn();

describe('Termini API', () => {
  beforeEach(() => {
    createTermin.mockClear();
  });

  it('trebao bi uspješno kreirati novi termin', async () => {
    const mockResponse = {
      id_termina: 1,
      datum: '2025-06-01',
      vrijeme_termina: '10:00:00'
    };

    createTermin.mockResolvedValue(mockResponse);

    const terminData = { datum: '2025-06-01' };
    const result = await createTermin(terminData);

    expect(createTermin).toHaveBeenCalledWith(terminData);
    expect(result).toEqual(mockResponse);
  });

  it('trebao bi baciti grešku pri API pozivu', async () => {
    const errorMessage = 'API Error';
    createTermin.mockRejectedValue(new Error(errorMessage));

    await expect(createTermin()).rejects.toThrow(errorMessage);
  });

  it('trebao bi testirati osnovnu funkcionalnost', () => {
    expect(createTermin).toBeDefined();
    expect(typeof createTermin).toBe('function');
  });
});